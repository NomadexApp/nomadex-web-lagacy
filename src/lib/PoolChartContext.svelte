<script lang="ts">
	import { onMount } from 'svelte';
	import { getSwapEvents, type SwapTxn, getDepositEvents } from '$lib/events';
	import CandleChart, { type PriceCandleData } from '$lib/chart/CandleChart.svelte';
	import { browser } from '$app/environment';
	import { TokenType, knownPools, type Token, knownTokens, type Pool } from '$lib';
	import { getStores } from '$app/stores';
	import { goto } from '$app/navigation';
	import { convertDecimals } from '$lib/numbers';
	import { openModal } from './components/modal/Modal.svelte';
	import SelectTokenModal from './components/modal/SelectTokenModal.svelte';
	import { pageContentRefresh } from './utils';

	const { page } = getStores();
	const tokenA = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenA);
	const tokenB = <Token>$knownTokens.find((token) => token.ticker === 'VOI');

	let voiToken: Token = <any>undefined;
	let arc200Token: Token = <any>undefined;
	let matchedPool: Pool = <any>undefined;

	export let price = 0;
	export let context = 'analytics';

	if (tokenA?.ticker === 'VOI' && tokenB?.type === TokenType.ARC200) {
		voiToken = tokenA;
		arc200Token = tokenB;
	} else if (tokenB?.ticker === 'VOI' && tokenA?.type === TokenType.ARC200) {
		voiToken = tokenB;
		arc200Token = tokenA;
	} else if (browser) {
		goto(`/`);
	}

	if (voiToken && arc200Token) {
		const match = $knownPools.find((pool) => pool.arc200Asset.assetId === arc200Token.id);
		if (match) matchedPool = match;
	}

	if (!matchedPool) {
		throw Error('pool not found');
	}

	enum Timescale {
		'15m' = 15 * 60,
		'30m' = 30 * 60,
		'1hr' = 60 * 60,
		'4hr' = 4 * 60 * 60,
		'1d' = 24 * 60 * 60,
	}

	let swapEvents: {
		sender: string;
		fromAmount: number;
		toAmount: number;
		direction: number;
		poolBals: [bigint, bigint];
		txn: SwapTxn;
	}[] = [];
	let depositEvents: {
		sender: string;
		amts: [bigint, bigint];
		lpt: bigint;
		adding: boolean;
		poolBals: [bigint, bigint];
		txn: SwapTxn;
	}[] = [];
	let pricingDirection: string = `${tokenA.ticker}/${tokenB.ticker}`;
	let timescale = browser
		? JSON.parse(localStorage.getItem('timescale') ?? JSON.stringify(Timescale['15m']))
		: Timescale['15m'];
	let logarithmic = false;

	$: browser && localStorage.setItem('timescale', JSON.stringify(timescale));

	async function loadSwapEvents() {
		swapEvents = await getSwapEvents(matchedPool.poolId);
		generateDataByTime(pricingDirection, timescale);
	}

	async function loadDepositEvents() {
		depositEvents = await getDepositEvents(matchedPool.poolId);
		generateDataByTime(pricingDirection, timescale);
	}

	onMount(() => {
		loadSwapEvents();
		loadDepositEvents();
		const interval = setInterval(() => {
			loadSwapEvents();
			loadDepositEvents();
		}, 10_000);
		return () => {
			clearInterval(interval);
		};
	});

	const getFromTokenFromEvent = (event: (typeof swapEvents)[0]) => {
		return event.direction === 0 ? voiToken : arc200Token;
	};

	const getToTokenFromEvent = (event: (typeof swapEvents)[0]) => {
		return event.direction === 0 ? arc200Token : voiToken;
	};

	let priceData: PriceCandleData[] = [];

	async function generateDataByTime(priceOf: string, duration = timescale) {
		const _priceData: PriceCandleData[] = [];
		const events = [...swapEvents].filter((e) => (e.direction === 0 ? e.fromAmount : e.toAmount) > 10);

		if (!events.length) return;

		let pricingCurrency = priceOf === `VOI/${arc200Token.ticker}` ? 0 : 1;

		const getTime = (event: (typeof events)[0]) => event.txn['round-time'];
		const getPrice = (event: (typeof events)[0]) => {
			let viaPrice =
				Number(convertDecimals(event.poolBals[0], 6, 6)) /
				Number(convertDecimals(event.poolBals[1], arc200Token.decimals, 6));
			viaPrice = viaPrice < 0.001 && arc200Token.ticker === 'VIA' ? 0 : viaPrice;

			if (viaPrice) {
				return pricingCurrency === 0 ? 1 / viaPrice : viaPrice;
			} else {
				const voiAmount = event.direction === 0 ? event.fromAmount : event.toAmount;
				const viaAmount = event.direction === 0 ? event.toAmount : event.fromAmount;

				return pricingCurrency === 0
					? viaAmount / arc200Token.unit / (voiAmount / voiToken.unit)
					: voiAmount / voiToken.unit / (viaAmount / arc200Token.unit);
			}
		};

		const getStartOfHour = (ms: number) => {
			let date = new Date(ms);
			while (date.getMinutes() !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0) {
				date = new Date(--ms);
			}
			return ms;
		};

		let close = 1;

		for (
			let time = Math.floor(getStartOfHour(getTime(events[0]) * 1000) / 1000) + 0.1;
			time < Math.floor(Date.now() / 1000);
			time += duration
		) {
			const matchingEvents = events.filter((e) => getTime(e) >= time && getTime(e) < time + duration);
			if (matchingEvents.length) {
				for (const event of matchingEvents) {
					event['price'] = getPrice(event);
				}

				const _low = matchingEvents.reduce((l, e) => Math.min(l, getPrice(e)), Number.MAX_SAFE_INTEGER);
				const _high = matchingEvents.reduce((h, e) => Math.max(h, getPrice(e)), 0);
				const _open = close;
				const _close = getPrice(matchingEvents[matchingEvents.length - 1]);

				_priceData.push({
					x: time * 1000,
					o: _open,
					c: _close,
					h: _high,
					l: _low,
				});

				close = _close;
				price = _close;
			} else {
				_priceData.push({
					x: time * 1000,
					o: close,
					c: close,
					h: close,
					l: close,
				});
			}
		}

		const checksum1 = _priceData.map((d) => `${d.x}:${d.o}:${d.h}:${d.l}:${d.c}`).join(':');
		const checksum2 = priceData.map((d) => `${d.x}:${d.o}:${d.h}:${d.l}:${d.c}`).join(':');
		if (checksum1 !== checksum2) {
			priceData = _priceData;
		}
	}

	let innerWidth = browser ? window.innerWidth : 0;
	let chartWidth = 0;
</script>

<svelte:window bind:innerWidth />

<section class="flex flex-col items-center gap-2 max-w-[900px] mx-auto">
	<div class="flex w-full gap-2">
		<button
			class="currency flex justify-center items-center mt-[0.1rem] p-2 py-0 w-[2.2rem] h-[1.8rem] rounded text-white bg-transparent"
			on:click={() => {
				openModal(SelectTokenModal, {
					tokens: $knownTokens.filter((token) => token.ticker !== 'VOI'),
					handleSelect(token) {
						goto(`/${context}/${token.ticker}${context === 'limit' ? `/${$page.params.action}` : ''}`);
						pageContentRefresh();
					},
				});
			}}
		>
			<svg style="width: 25px;" viewBox="0 0 12 7" fill="none" xmlns="http://www.w3.org/2000/svg" class="">
				<path d="M0.97168 1L6.20532 6L11.439 1" stroke="currentColor" stroke-width="2px" />
			</svg>
		</button>
		<h1 class="text-3xl">
			{tokenA.ticker}
		</h1>
	</div>
	<div class="flex flex-wrap gap-4 justify-between items-center w-full max-w-[900px]">
		<div class="cursor-pointer flex flex-col">
			<span class="text-2xl">
				Price ≈ {price < 0.1 ? Number(price.toFixed(10)) : price.toLocaleString('en')}
				{pricingDirection.split('/')[1]}
			</span>
			<span />
		</div>
		<div>
			<button
				class="btn btn-sm btn-ghost border-none bg-[#00000040] hover:bg-[#00000040] hover:opacity-70 text-white hidden sm:inline-flex rounded-[4px]"
				on:click={() => {
					logarithmic = !logarithmic;
					generateDataByTime(pricingDirection);
				}}>{logarithmic ? 'linear' : 'log'}</button
			>
			<button
				class="btn btn-sm {timescale === Timescale['15m']
					? 'btn-primary'
					: 'btn-ghost border-none bg-[#00000040] hover:bg-[#00000040] hover:opacity-70 text-white'} hidden sm:inline-flex rounded-[4px]"
				on:click={() => {
					timescale = Timescale['15m'];
					generateDataByTime(pricingDirection);
				}}>15m</button
			>
			<button
				class="btn btn-sm {timescale === Timescale['30m']
					? 'btn-primary'
					: 'btn-ghost border-none bg-[#00000040] hover:bg-[#00000040] hover:opacity-70 text-white'} hidden sm:inline-flex rounded-[4px]"
				on:click={() => {
					timescale = Timescale['30m'];
					generateDataByTime(pricingDirection);
				}}>30m</button
			>
			<button
				class="btn btn-sm {timescale === Timescale['1hr']
					? 'btn-primary'
					: 'btn-ghost border-none bg-[#00000040] hover:bg-[#00000040] hover:opacity-70 text-white'} hidden sm:inline-flex rounded-[4px]"
				on:click={() => {
					timescale = Timescale['1hr'];
					generateDataByTime(pricingDirection);
				}}>1hr</button
			>
			<button
				class="btn btn-sm {timescale === Timescale['4hr']
					? 'btn-primary'
					: 'btn-ghost border-none bg-[#00000040] hover:bg-[#00000040] hover:opacity-70 text-white'} hidden sm:inline-flex rounded-[4px]"
				on:click={() => {
					timescale = Timescale['4hr'];
					generateDataByTime(pricingDirection);
				}}>4hr</button
			>
			<button
				class="btn btn-sm {timescale === Timescale['1d']
					? 'btn-primary'
					: 'btn-ghost border-none bg-[#00000040] hover:bg-[#00000040] hover:opacity-70 text-white'} hidden sm:inline-flex rounded-[4px]"
				on:click={() => {
					timescale = Timescale['1d'];
					generateDataByTime(pricingDirection);
				}}>1d</button
			>
		</div>
	</div>
	<div
		class="chart-container min-w-[250px] w-full overflow-hidden bg-[#00000033] rounded-[8px]"
		bind:clientWidth={chartWidth}
		style="min-height: {chartWidth / 2.6}px;"
	>
		<CandleChart
			label={`Price of ${pricingDirection.split('/').join(' in ')}`}
			{logarithmic}
			data={priceData.slice(-80)}
		/>
	</div>

	<slot
		name="swap-events"
		{tokenA}
		{tokenB}
		{arc200Token}
		{voiToken}
		{swapEvents}
		{getFromTokenFromEvent}
		{getToTokenFromEvent}
	/>
	<slot
		name="liquidity-events"
		{tokenA}
		{tokenB}
		{arc200Token}
		{voiToken}
		{depositEvents}
		{getFromTokenFromEvent}
		{getToTokenFromEvent}
	/>
</section>

<style>
	section {
		width: 100%;
	}
	.chart-container {
		backdrop-filter: blur(5px);
		width: 100%;
		display: flex;
		justify-content: center;
		max-height: 500px;
		max-width: 900px;
		padding-right: 0.5rem;
	}

	@media (max-width: 300px) {
		.chart-container {
			display: none;
		}
	}
</style>

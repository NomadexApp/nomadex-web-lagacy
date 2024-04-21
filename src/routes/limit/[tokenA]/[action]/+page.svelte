<script lang="ts">
	import { onMount } from 'svelte';
	import { contracts, knownTokens, TokenType, type Token } from '$lib';
	import { nodeClient } from '$lib/_shared';
	import algosdk from 'algosdk';
	import { convertDecimals } from '$lib/numbers';
	import { getStores } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import PoolChartContext from '$lib/PoolChartContext.svelte';
	import { lastActiveLimitOrderPair } from '$lib/stores';
	import LimitForm from '$lib/components/form/LimitForm.svelte';
	import LimitOrder from '$lib/LimitOrder.svelte';
	import { LimitOrderType, LimitOrders001ClientConnector } from '$lib/LimitOrderConnector';
	import { pageContentRefresh } from '$lib/utils';
	import { onChainStateWatcher, watchArc200Balance } from '$lib/stores/onchain';
	import { connectedAccount } from '$lib/UseWallet.svelte';
	import CurrencyNumber from '$lib/CurrencyNumber.svelte';
	import { openModal } from '$lib/components/modal/Modal.svelte';
	import ConnectWallet from '$lib/components/modal/ConnectWallet.svelte';
	import Join from '$lib/components/join/Join.svelte';

	const { page } = getStores();
	const tokenA = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenA);
	const tokenB = <Token>$knownTokens.find((token) => token.ticker === 'VOI');

	let voiToken: Token = <any>undefined;
	let arc200Token: Token = <any>undefined;

	if (tokenA?.ticker === 'VOI' && tokenB?.type === TokenType.ARC200) {
		voiToken = tokenA;
		arc200Token = tokenB;
	} else if (tokenB?.ticker === 'VOI' && tokenA?.type === TokenType.ARC200) {
		voiToken = tokenB;
		arc200Token = tokenA;
	} else if (browser) {
		goto(`/`);
	}

	if (arc200Token) {
		lastActiveLimitOrderPair.set(arc200Token.ticker);
	}

	let limitOrders: {
		orderId: number;
		name: Uint8Array;
		value: Uint8Array;
		maker: string;
		arc200Id: number;
		arc200Token: Token;
		algoAmount: number;
		arc200Amount: bigint;
		isDirectionFromArc200ToAlgo: number;
	}[] = [];
	let loading = false;

	async function fetchOrders() {
		try {
			const { boxes: boxesNames } = await nodeClient.getApplicationBoxes(contracts.orderbookLimitOrderApp).do();

			const boxes = await Promise.all(
				boxesNames.map((box) => nodeClient.getApplicationBoxByName(contracts.orderbookLimitOrderApp, box.name).do())
			);

			limitOrders = boxes
				.map((box) => {
					const [maker, arc200Id, algoAmount, arc200Amount, isDirectionFromArc200ToAlgo] = <
						[string, bigint, bigint, bigint, bigint]
					>algosdk.ABITupleType.from('(address,uint64,uint64,uint256,uint8)').decode(box.value);
					return {
						orderId: Number('0x' + Buffer.from(box.name).toString('hex')),
						name: box.name,
						value: box.value,
						maker,
						arc200Id: Number(arc200Id),
						arc200Token: <Token>$knownTokens.find((t) => t.id === Number(arc200Id)),
						algoAmount: Number(algoAmount),
						arc200Amount,
						isDirectionFromArc200ToAlgo: Number(isDirectionFromArc200ToAlgo),
					};
				})
				.filter((b) => b.arc200Token);
		} catch (e) {}
	}

	onMount(async () => {
		loading = true;
		fetchOrders().finally(() => {
			loading = false;
		});
		const timeout = setInterval(() => fetchOrders(), 15_000);
		return () => clearTimeout(timeout);
	});

	const connectedUserState = onChainStateWatcher.getAccountWatcher($connectedAccount);
	const arc200Balance = watchArc200Balance(arc200Token.id, $connectedAccount);

	let sortedLimitOrders: Record<
		string,
		{
			sellOrders: typeof limitOrders;
			buyOrders: typeof limitOrders;
		}
	> = {};

	$: sortedLimitOrders = ((limitOrders) => {
		const orders: typeof sortedLimitOrders = {};
		for (const order of limitOrders) {
			if (!orders[order.arc200Id]) {
				orders[order.arc200Id] = { sellOrders: [], buyOrders: [] };
			}
			if (order.isDirectionFromArc200ToAlgo) {
				orders[order.arc200Id].sellOrders = [...(orders[order.arc200Id].sellOrders ?? []), order];
			} else {
				orders[order.arc200Id].buyOrders = [...(orders[order.arc200Id].buyOrders ?? []), order];
			}
		}
		const getPrice = (o: (typeof limitOrders)[0]) =>
			o.algoAmount / Number(convertDecimals(o.arc200Amount, o.arc200Token.decimals, 6));

		for (const key in orders) {
			const sellOrders = orders[key].sellOrders.sort((a, b) => b.orderId - a.orderId);
			const buyOrders = orders[key].buyOrders.sort((a, b) => b.orderId - a.orderId);

			orders[key].sellOrders = sellOrders.sort((a, b) => getPrice(b) - getPrice(a));
			orders[key].buyOrders = buyOrders.sort((a, b) => getPrice(b) - getPrice(a));
		}
		return orders;
	})(limitOrders);

	let price = 0;
	let lazyPrice = Number(price.toFixed(6));

	const updatePriceInput = (price: number) => {
		if (!lazyPrice && price) {
			lazyPrice = Number(price.toFixed(6));
		}
	};

	$: updatePriceInput(price);

	let disabled = false;

	let inputTokenA = 0;

	async function createLimitOrder() {
		const inputTokenB = $page.params.action === 'buy' ? inputTokenA / lazyPrice : inputTokenA * lazyPrice;

		if (!tokenA || !tokenB) return;
		const prev = disabled;
		disabled = true;

		const tokenAAmount = Math.floor(inputTokenA * tokenA.unit);
		const tokenBAmount = Math.floor(inputTokenB * tokenB.unit);
		const connector = new LimitOrders001ClientConnector(contracts.orderbookLimitOrderApp);

		if ($page.params.action === 'buy') {
			await connector.invoke(
				'createOrder',
				LimitOrderType.SELL_ALGO_FOR_ARC200,
				arc200Token.id,
				BigInt(tokenAAmount),
				BigInt(tokenBAmount)
			);
			pageContentRefresh(0);
		} else {
			await connector.invoke(
				'createOrder',
				LimitOrderType.SELL_ARC200_FOR_ALGO,
				arc200Token.id,
				BigInt(tokenBAmount),
				BigInt(tokenAAmount)
			);
			pageContentRefresh(0);
		}
		disabled = prev;
	}

	function aggregateOrders(
		orders: {
			orderId: number;
			name: Uint8Array;
			value: Uint8Array;
			maker: string;
			arc200Id: number;
			arc200Token: Token;
			algoAmount: number;
			arc200Amount: bigint;
			isDirectionFromArc200ToAlgo: number;
		}[],
		range: number
	) {
		const aggregated: { price: number; total: bigint; orders: typeof orders }[] = [];
		for (const order of orders) {
			const price = order.algoAmount / Number(convertDecimals(order.arc200Amount, tokenA.decimals, 6));
			const c = 10 ** -Math.log10(range);
			const approxPrice = Number(Math.floor(price * c) / c);
			let priceGroup = aggregated.find((grp) => grp.price === approxPrice);
			if (!priceGroup) {
				priceGroup = { price: approxPrice, total: 0n, orders: [] };
				aggregated.push(priceGroup);
			}
			priceGroup.total += order.arc200Amount;
			priceGroup.orders.push(order);
		}
		return aggregated;
	}
	let rangeSelectElement: HTMLDetailsElement;
	let range = JSON.parse(browser ? localStorage.getItem('LIMIT_ORDERBOOK_PRICE_RANGE') || '0.001' : '0.001');
	let rangeOptions = [1, 0.1, 0.01, 0.001, 0.0001];

	$: browser && localStorage.setItem('LIMIT_ORDERBOOK_PRICE_RANGE', JSON.stringify(range));
</script>

<svelte:window
	on:click={() => {
		if (!rangeSelectElement) return;
		rangeSelectElement.open = false;
	}}
/>

<section class="flex flex-col justify-center max-w-[1200px] mx-auto">
	<div class="flex flex-col justify-start w-full overflow-auto mb-8">
		<PoolChartContext bind:price context="limit" />
	</div>
	<div class="flex justify-end w-full max-w-[500px] mx-auto">
		<details
			bind:this={rangeSelectElement}
			class="dropdown dropdown-bottom dropdown-end"
			on:blur={() => console.log('blu')}
			on:click|stopPropagation
			on:keydown
		>
			<summary class="btn btn-sm btn-ghost mb-2 flex gap-1 items-center">
				{range}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-4 h-4"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
				</svg>
			</summary>
			<ul class="dropdown-content z-[1] menu p-0 shadow rounded-box w-24 bg-[#222222]">
				{#each rangeOptions as opt}
					<li
						class="hover:bg-[#ffffff20] rounded-sm"
						on:click={() => {
							range = opt;
							rangeSelectElement.open = false;
						}}
						on:keydown
					>
						<a href={null}>{opt}</a>
					</li>
				{/each}
			</ul>
		</details>
	</div>
	<div
		class="flex flex-col justify-center max-w-[500px] w-full mx-auto bg-[#00000033] backdrop-blur-[5px] rounded-btn mb-4 py-2 px-2 overflow-hidden"
	>
		{#if loading}
			<div class="w-full min-h-44 flex justify-center items-center">
				<span class="loading text-primary" />
			</div>
		{:else}
			{#each Object.keys(sortedLimitOrders).filter((key) => Number(key) === arc200Token.id) as key}
				{@const sellOrders = sortedLimitOrders[key].sellOrders}
				{@const buyOrders = sortedLimitOrders[key].buyOrders}

				<div class="flex flex-col-reverse min-[300px]:flex-row">
					<div class="flex flex-col flex-grow w-full">
						<div class="flex-grow">
							<div class="flex justify-between p-2 px-2 font-[500] sm:pl-3">
								<span class="">Bid</span>
								<span class="" />
							</div>
						</div>
						<div class="flex-grow h-full max-h-[200px] overflow-y-auto">
							{#each aggregateOrders(buyOrders, range).slice(0, 5) as group}
								<div
									on:click={() => (lazyPrice = group.price)}
									on:keydown
									class="cursor-pointer w-full p-2 px-2 sm:px-3 rounded flex flex-row-reverse min-[300px]:flex-row justify-between items-center gap-1 max-w-[800px] hover:bg-[#ffffff20]"
								>
									<span class="text-[0.8rem] sm:text-[1rem]">
										<CurrencyNumber amount={Number(convertDecimals(group.total, tokenA.decimals, 6)) / 1e6} />
									</span>
									<span class="text-green-300 text-[0.8rem] sm:text-[1rem] font-mono">
										{group.price.toFixed(-Math.log10(range))}
									</span>
								</div>
							{/each}
						</div>
					</div>
					<div class="flex flex-col flex-grow w-full">
						<div class="flex-grow">
							<div class="flex justify-between p-2 px-2 font-[500] sm:pl-3">
								<span class="">Ask</span>
								<span class="" />
							</div>
						</div>
						<div class="flex-grow h-full max-h-[200px] overflow-y-auto">
							{#each aggregateOrders([...sellOrders].reverse(), range).slice(0, 5) as group}
								<div
									on:click={() => (lazyPrice = group.price)}
									on:keydown
									class="cursor-pointer w-full p-2 px-2 sm:px-3 rounded flex justify-between items-center gap-1 max-w-[800px] hover:bg-[#ffffff20]"
								>
									<span class="text-red-400 text-[0.8rem] sm:text-[1rem] font-mono">
										{group.price.toFixed(-Math.log10(range))}
									</span>
									<span class="text-[0.8rem] sm:text-[1rem] text-justify">
										<CurrencyNumber amount={Number(convertDecimals(group.total, tokenA.decimals, 6)) / 1e6} />
									</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<div class="w-full max-w-[500px] mx-auto">
		<Join
			items={[
				{
					id: 'buy',
					name: `Buy ${arc200Token.ticker}`,
					href: `/limit/${tokenA.ticker}/buy`,
					'data-sveltekit-noscroll': true,
				},
				{
					id: 'sell',
					name: `Sell ${arc200Token.ticker}`,
					href: `/limit/${tokenA.ticker}/sell`,
					'data-sveltekit-noscroll': true,
				},
			]}
			active={$page.params.action === 'sell' ? 'sell' : 'buy'}
			on:select={() => (inputTokenA = 0)}
		/>
	</div>
	<div class="br" />
	<div class="max-w-[900px] w-full mx-auto flex gap-2">
		<LimitForm
			bind:price={lazyPrice}
			buying={$page.params.action === 'buy'}
			{tokenA}
			{tokenB}
			{disabled}
			tokenABalance={(Number($arc200Balance) - 1) / arc200Token.unit}
			tokenBBalance={Math.max(0, $connectedUserState.amount - (($connectedUserState['min-balance'] ?? 0) + 100_000)) /
				1e6}
			bind:tokenAInput={inputTokenA}
			handleSubmit={() => {
				if ($connectedAccount) {
					createLimitOrder();
				} else {
					openModal(ConnectWallet, {});
				}
			}}
		/>
	</div>
	<div class="br" />

	{#if $connectedAccount}
		<div class="flex flex-col justify-center pt-6 max-w-[500px] w-full mx-auto">
			{#if loading}
				<div class="w-full min-h-44 flex justify-center items-center">
					<span class="loading text-primary" />
				</div>
			{:else}
				{#each Object.keys(sortedLimitOrders).filter((key) => Number(key) === arc200Token.id) as key}
					{@const sellOrders = sortedLimitOrders[key].sellOrders?.filter((o) => o.maker === $connectedAccount)}
					{@const buyOrders = sortedLimitOrders[key].buyOrders?.filter((o) => o.maker === $connectedAccount)}
					{#if sellOrders.length || buyOrders.length}
						<div class="flex justify-center">
							<h4 class="text-xl w-full mb-5 font-medium">My orders</h4>
						</div>
						<div class="bg-[#00000033] backdrop-blur-[5px] rounded-[8px] p-2">
							<div
								class="w-full event font-medium p-3 px-2 sm:px-3 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
							>
								<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 flex">Price</span>
								<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 flex">Amount</span>
								<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-10 sm:w-10 text-justify flex justify-end" />
							</div>
							{#each [...sellOrders].reverse() as limitOrder}
								<LimitOrder buy={false} order={limitOrder} />
							{/each}

							{#each buyOrders as limitOrder}
								<LimitOrder buy={true} order={limitOrder} />
							{/each}
						</div>

						<div class="br" />
						<div class="br" />
					{/if}
				{/each}
			{/if}
		</div>
	{/if}
	<div class="br" />
	<div class="br" />
	<div class="br" />
</section>

<style>
	/* .half::-webkit-scrollbar {
		-webkit-appearance: none;
		width: 7px;
	}
	.half::-webkit-scrollbar-thumb {
		border-radius: 4px;
		background-color: rgba(0, 0, 0, 0.5);
		-webkit-box-shadow: 0 0 1px rgba(255, 255, 255, 0.5);
	} */
	* {
		box-sizing: border-box;
	}
	section {
		display: flex;
		width: 100%;
		min-height: 100vh;
	}
</style>

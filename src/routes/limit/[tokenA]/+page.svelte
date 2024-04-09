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
	let lazyPrice = price;

	$: if (!lazyPrice && price) {
		lazyPrice = price;
	}

	let buying = true;
	let disabled = false;

	let inputTokenA = 0;

	async function createLimitOrder() {
		const inputTokenB = buying ? inputTokenA / price : inputTokenA * price;

		if (!tokenA || !tokenB) return;
		const prev = disabled;
		disabled = true;

		const tokenAAmount = Math.floor(inputTokenA * tokenA.unit);
		const tokenBAmount = Math.floor(inputTokenB * tokenB.unit);
		const connector = new LimitOrders001ClientConnector(contracts.orderbookLimitOrderApp);

		if (buying) {
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
</script>

<section class="flex flex-col justify-center max-w-[1200px] mx-auto">
	<div class="flex flex-col justify-start w-full overflow-auto">
		<PoolChartContext bind:price context="limit" />
	</div>
	<div class="join grid grid-cols-2 w-full max-w-[500px] mx-auto">
		<button
			class="join-item btn hover:outline-none btn-outline text-[#ffffdd] hover:bg-[#ffff66]"
			class:active={buying}
			on:click={() => {
				buying = true;
				inputTokenA = 0;
			}}
		>
			Buy {arc200Token.ticker}
		</button>
		<button
			class="join-item btn hover:outline-none btn-outline text-[#ffffdd] hover:bg-[#ffff66]"
			class:active={!buying}
			on:click={() => {
				buying = false;
				inputTokenA = 0;
			}}
		>
			Sell {arc200Token.ticker}
		</button>
	</div>
	<br />
	<div class="flex flex-col justify-center pt-6 max-w-[500px] w-full mx-auto">
		{#if loading}
			<div class="w-full min-h-44 flex justify-center items-center">
				<span class="loading text-primary" />
			</div>
		{:else}
			{#each Object.keys(sortedLimitOrders).filter((key) => Number(key) === arc200Token.id) as key}
				{@const sellOrders = sortedLimitOrders[key].sellOrders}
				{@const buyOrders = sortedLimitOrders[key].buyOrders}
				<!-- <div class="h-[2px]" /> -->
				<div class="flex justify-center">
					<h4 class="text-xl w-full mb-5">Best limit orders ({buying ? 'Buy' : 'Sell'})</h4>
				</div>
				<div
					class="w-full event bg-[#ffff6605] font-bold p-3 px-2 sm:px-3 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
				>
					<span class="hidden sm:inline-block flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28"> User </span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 flex">Price</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 flex">Amount</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 flex">Total</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-10 sm:w-10 flex">&nbsp;</span>
				</div>
				{#if buying}
					{#each buyOrders as limitOrder}
						<LimitOrder order={limitOrder} />
					{/each}
				{:else}
					{#each [...sellOrders].reverse() as limitOrder}
						<LimitOrder order={limitOrder} />
					{/each}
				{/if}
				<br />
				<br />
			{/each}
		{/if}
	</div>
	<div class="max-w-[900px] w-full mx-auto flex gap-2">
		<LimitForm
			price={Number(lazyPrice.toFixed(6))}
			{buying}
			{tokenA}
			{tokenB}
			tokenABalance={(Number($arc200Balance) - 1) / arc200Token.unit}
			tokenBBalance={($connectedUserState.amount - ($connectedUserState['min-balance'] ?? 0)) / 1e6}
			bind:tokenAInput={inputTokenA}
			handleSubmit={() => {
				createLimitOrder();
			}}
		/>
	</div>
	<br />
	<br />
	<br />
	<br />
	<br />
	<br />
	<br />
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

	.join-item.active {
		color: #000000;
		background: #ffff66;
	}
</style>

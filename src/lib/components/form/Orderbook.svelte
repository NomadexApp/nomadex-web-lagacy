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
	import LimitOrder from '$lib/LimitOrder.svelte';

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

	let selectedOrder: number | undefined;
	let amounts: Record<string, number> = {};

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
			Number(convertDecimals(o.arc200Amount, o.arc200Token.decimals, 6)) / o.algoAmount;

		for (const key in orders) {
			const sellOrders = orders[key].sellOrders.sort((a, b) => b.orderId - a.orderId);
			const buyOrders = orders[key].buyOrders.sort((a, b) => b.orderId - a.orderId);

			orders[key].sellOrders = sellOrders.sort((a, b) => getPrice(b) - getPrice(a));
			orders[key].buyOrders = buyOrders.sort((a, b) => getPrice(b) - getPrice(a));
		}
		return orders;
	})(limitOrders);

	function scrollIntoView(node: HTMLDivElement) {
		node.scroll({ top: node.scrollHeight, left: 0 });
	}

	let price = 0;
</script>

<form class="form flex flex-col justify-start min-h-40 flex-grow w-[275px] text-[12px]">
	{#if loading}
		<div class="w-full min-h-44 flex justify-center items-center">
			<span class="loading text-primary" />
		</div>
	{:else}
		{#each Object.keys(sortedLimitOrders).filter((key) => arc200Token.id === Number(key)) as key}
			<div class="w-full flex flex-col p-2 px-4 relative">
				<div class="pool rounded-btn flex flex-col gap-2 w-[275px] text-[0.75rem]">
					<div class="flex justify-evenly cursor-pointer select-none" on:click={() => {}} on:keydown>
						<span class="name mb-0 w-full flex gap-4">
							<span class="w-16 flex flex-wrap gap-2">
								<span>Price</span>
								<span class="">{tokenB.ticker}</span>
							</span>
							<span class="w-24 tflex flex-wrap gap-2">
								<span>Amount</span>
								<span class="">{tokenA.ticker}</span>
							</span>
							<span class="w-16 flex flex-wrap gap-2 text-right">
								<span>Total</span>
								<span class="">{tokenB.ticker}</span>
							</span>
						</span>
					</div>
				</div>
			</div>
			{@const sellOrders = sortedLimitOrders[key].sellOrders}
			{@const buyOrders = sortedLimitOrders[key].buyOrders}
			<div class="flex flex-col text-sm max-h-[700px]">
				<div
					class="half flex-grow flex flex-col py-1 justify-start max-h-[215px] overflow-y-scroll"
					use:scrollIntoView
				>
					{#each Array(Math.max(buyOrders.length, 7 - buyOrders.length))
						.fill(undefined)
						.concat(buyOrders) as limitOrder}
						{#if limitOrder}
							<LimitOrder
								order={limitOrder}
								opened={selectedOrder === limitOrder.orderId}
								onSelect={() => {
									selectedOrder = selectedOrder === limitOrder.orderId ? undefined : limitOrder.orderId;
								}}
							/>
						{:else}
							<div class="w-full flex flex-col p-4 px-4 relative" />
						{/if}
					{/each}
				</div>
				<div class="h-[1.5rem] py-1 px-4">{Number(price.toFixed(6))}</div>
				<div class="half flex-grow flex flex-col py-1 justify-start max-h-[215px] overflow-y-scroll">
					{#each sellOrders.concat(Array(Math.max(sellOrders.length, 7 - sellOrders.length)).fill(undefined)) as limitOrder}
						{#if limitOrder}
							<LimitOrder
								order={limitOrder}
								opened={selectedOrder === limitOrder.orderId}
								onSelect={() => {
									selectedOrder = selectedOrder === limitOrder.orderId ? undefined : limitOrder.orderId;
								}}
							/>
						{:else}
							<div class="w-full flex flex-col p-4 px-4 relative" />
						{/if}
					{/each}
				</div>
			</div>
			<br />
		{/each}
	{/if}
</form>

<style>
	form {
		background-color: var(--primary-color);
		margin: 0 auto 0 auto;
		height: max-content;
		padding: 2rem;
		background: #222211;
		border-radius: 8px;
		width: 500px;
		max-width: calc(100vw - 2rem);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>

<script lang="ts" context="module">
	import { writable } from 'svelte/store';

	export const aprCacheStore = writable<{ [k: string]: [number, bigint] }>({});
</script>

<script lang="ts">
	import type { Pool } from '$lib';
	import algosdk from 'algosdk';
	import { readableNumber } from './CurrencyNumber.svelte';
	import { getArc200Balance, getBalance, nodeClient } from './_shared';
	import { SwapEvents, type SwapTxn } from './events';
	import { Arc200Interface } from './utils';
	import { watchArc200Balance } from './stores/onchain';
	import { connectedAccount } from './UseWallet.svelte';

	export let pool: Pool & { balances: { [k: string]: any } };
	export let checkForLpt = false;
	export let my = false;

	const algoBalance = pool.balances.algo;

	const promises: Promise<any>[] = [];
	let currentRound = 0;

	let updateCounter = 0;

	const poolLptBalance = watchArc200Balance(pool.poolId, algosdk.getApplicationAddress(pool.poolId));
	const lptBalance = watchArc200Balance(pool.poolId, $connectedAccount);

	$: sharePercent = Number($lptBalance * 100n) / Number(100_000_000_000_000_000_000n - $poolLptBalance);

	async function getApr(pool: Pool, i = 0): Promise<[number, bigint]> {
		if ($aprCacheStore[pool.poolId]) return $aprCacheStore[pool.poolId];
		$aprCacheStore[pool.poolId] = $aprCacheStore[pool.poolId] || [0.000001, 0n];

		for (const p of promises) {
			try {
				await p;
			} catch (e) {}
		}

		if (!currentRound) currentRound = (await nodeClient.status().do())['last-round'];

		let txns: SwapTxn[] = [];
		for (let i = 0; i < 10; i++) {
			try {
				txns = await SwapEvents.loadTxns(pool.poolId, currentRound - 800_000, currentRound);
				break;
			} catch (e) {
				//
			}
		}

		const swapEvent = 'Swap(address,(uint256,uint256),(uint256,uint256),(uint256,uint256))';
		const depositEvent = 'Deposit(address,(uint256,uint256),uint256,(uint256,uint256))';
		const withdrawEvent = 'Withdraw(address,uint256,(uint256,uint256),(uint256,uint256))';
		const parsedTxns: Record<
			string,
			(SwapTxn & {
				events: {
					[x: string]: algosdk.ABIValue[];
				};
			})[]
		> = SwapEvents.parseEvents(txns, [depositEvent, withdrawEvent, swapEvent]);

		type Event = {
			sender: string;
			amts: bigint[];
			txn: SwapTxn & {
				events: {
					[x: string]: algosdk.ABIValue[];
				};
			};
		};

		let volume = 0n;
		const data: (Event & { lpt: number; adding: boolean; poolBals: number[] })[] = [];

		for (const txns of Object.values(parsedTxns)) {
			for (const txn of txns) {
				for (const [eventSignature, events] of Object.entries(txn.events)) {
					for (const event of events) {
						if (eventSignature === depositEvent) {
							const [sender, inAmts, outLpt, poolBals] = <any>(<unknown>event);
							data.push({
								sender: sender,
								amts: inAmts,
								lpt: outLpt,
								adding: true,
								poolBals: poolBals,
								txn: txn,
							});
						} else if (eventSignature === withdrawEvent) {
							const [sender, inLpt, outAmts, poolBals] = <any>(<unknown>event);
							data.push({
								sender: sender,
								amts: outAmts,
								lpt: inLpt,
								adding: false,
								poolBals: poolBals,
								txn: txn,
							});
						} else if (eventSignature === swapEvent) {
							if (Date.now() - txn['round-time'] * 1000 <= 7 * 86400000) {
								const [, inAmts, outAmts] = <any>(<unknown>event);
								volume += inAmts[0] > 0n ? inAmts[0] : outAmts[0];
							}
						}
					}
				}
			}
		}

		const blocks = data.sort((event, event1) => event.txn['confirmed-round'] - event1.txn['confirmed-round']);
		const block = blocks[0];
		if (!block) {
			updateCounter++;
			return [0, volume];
		}

		const poolAddress = algosdk.getApplicationAddress(pool.poolId);
		const voiBalance = await getBalance(poolAddress);
		const arc200Balance = await getArc200Balance(pool.arc200Asset.assetId, poolAddress);
		const lptSupply = await Arc200Interface.arc200_totalSupply(pool.poolId);

		const dataPoints = [
			{
				round: block.txn['confirmed-round'],
				time: block.txn['round-time'],
				value: Math.sqrt(Number(block.amts[0]) * Number(block.amts[1])) / Number(block.lpt),
			},
			{
				round: currentRound,
				time: Math.floor(Date.now() / 1000),
				value: Math.sqrt(voiBalance * arc200Balance) / Number(lptSupply),
			},
		];

		const timeDiff = dataPoints[1].time - dataPoints[0].time;
		const valueDiffPercent = ((dataPoints[1].value - dataPoints[0].value) * 100) / dataPoints[0].value;

		const apr = (!timeDiff ? 0 : (valueDiffPercent / Math.max(1, timeDiff)) * (365 * 24 * 60 * 60)) || 0;
		$aprCacheStore[pool.poolId] = [apr, volume];

		updateCounter++;

		return [apr, volume];
	}
</script>

{#if !checkForLpt || $lptBalance > 0n}
	<div class="pool sm:grid bg-[#00000033] sm:bg-transparent rounded-[8px]">
		<div class="name flex gap-2 w-full">
			<div class="hidden sm:flex icon avatar w-7 h-7 bg-[#666633] rounded-full justify-center items-center">?</div>
			<div
				class="hidden sm:flex icon avatar w-7 h-7 bg-[#666666] rounded-full justify-center items-center ml-[-1.25rem]"
			>
				?
			</div>
			<span class="text-nowrap inline-flex items-center">
				{pool.arc200Asset.symbol} <span class="text-gray-300 mx-1">/</span> VOI
			</span>
		</div>
		<div class="flex items-center w-[40%] sm:w-[50px] text-nowrap">
			{readableNumber((($algoBalance * 2) / 1e6) * (my ? sharePercent / 100 : 1))} VOI
		</div>
		{#await getApr(pool, updateCounter)}
			<div class="hidden sm:inline-flex items-center w-[40%] sm:w-[50px] text-nowrap">0 VOI</div>
			<div class="flex sm:inline-flex items-center w-[40%] sm:w-[50px] text-nowrap">0 %</div>
		{:then [apr, volume]}
			<div class="hidden sm:inline-flex items-center w-[40%] sm:w-[50px] text-nowrap">
				{readableNumber(Number(volume) / 1e6)} VOI
			</div>
			<div class="flex sm:inline-flex items-center w-[40%] sm:w-[50px] text-nowrap">
				{Number((apr ?? 0).toFixed(apr > 10 ? 0 : 2))} %
			</div>
		{:catch err}
			<div class="hidden sm:inline-flex items-center w-[40%] sm:w-[50px] text-nowrap">{err.message}</div>
			<div class="flex sm:inline-flex items-center w-[40%] sm:w-[50px] text-nowrap">{err.message}</div>
		{/await}
		<div class="w-full flex justify-end">
			{#if $lptBalance > 0n}
				<button class="btn btn-sm btn-square btn-ghost text-white">
					<a class="scale-150 font-thin" href="/liquidity/{pool.arc200Asset.symbol}/remove">-</a>
				</button>
			{/if}
			<button class="btn btn-sm btn-square btn-ghost text-white">
				<a class="scale-150 font-thin" href="/liquidity/{pool.arc200Asset.symbol}/add">+</a>
			</button>
		</div>
	</div>
{/if}

<style>
	.pool > div:not(.hidden) {
		display: inline-flex;
	}
</style>

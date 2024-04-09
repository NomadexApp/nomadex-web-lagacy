<script lang="ts" context="module">
	import { writable } from 'svelte/store';

	export const aprCacheStore = writable<{ [k: string]: number }>({});
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

	const algoBalance = pool.balances.algo;

	const promises: Promise<any>[] = [];
	let currentRound = 0;

	let updateCounter = 0;

	const lptBalance = watchArc200Balance(pool.poolId, $connectedAccount);

	async function getApr(pool: Pool, i = 0) {
		if ($aprCacheStore[pool.poolId]) return $aprCacheStore[pool.poolId];
		$aprCacheStore[pool.poolId] = $aprCacheStore[pool.poolId] || 0.000001;

		for (const p of promises) {
			try {
				await p;
			} catch (e) {}
		}

		if (!currentRound) currentRound = (await nodeClient.status().do())['last-round'];

		let txns: SwapTxn[] = [];
		for (let i = 0; i < 10; i++) {
			try {
				txns = await SwapEvents.loadTxns(pool.poolId, currentRound - 800_000, currentRound - 30000);
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
		> = SwapEvents.parseEvents(txns, [depositEvent, withdrawEvent]);

		const data: {
			sender: string;
			amts: number[];
			lpt: number;
			adding: boolean;
			poolBals: number[];
			txn: SwapTxn & {
				events: {
					[x: string]: algosdk.ABIValue[];
				};
			};
		}[] = [];

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
						}
					}
				}
			}
		}

		const blocks = data.sort((event, event1) => event.txn['confirmed-round'] - event1.txn['confirmed-round']);
		const block = blocks[0];
		if (!block) {
			updateCounter++;
			return 0;
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
		$aprCacheStore[pool.poolId] = apr;

		updateCounter++;

		return apr;
	}
</script>

{#if !checkForLpt || $lptBalance > 0n}
	<tr class="pool mb-2 justify-between bg-[#ffff6605] hover:bg-[#ffff6611] rounded p-2 cursor-pointer flex flex-wrap">
		<td class="flex gap-2">
			<div class="hidden sm:flex icon avatar w-7 h-7 bg-[#666633] rounded-full justify-center items-center">?</div>
			<div class="hidden sm:flex ml-[-1rem] icon avatar w-7 h-7 bg-[#666633] rounded-full justify-center items-center">
				?
			</div>
			<div class="flex flex-col justify-center w-[90px]">
				<span class="name inline-block text-nowrap"
					>{pool.arc200Asset.symbol} <span class="text-gray-500">/</span> VOI</span
				>
			</div>
		</td>
		<td class="w-20 text-nowrap">{readableNumber(($algoBalance * 2) / 1e6)} VOI</td>
		<td class="hidden sm:inline-block w-[50px] text-nowrap">
			{#await getApr(pool, updateCounter)}
				0 %
			{:then apr}
				{Number(apr.toFixed(apr > 10 ? 0 : 2))} %
			{:catch err}
				{err.message}
			{/await}
		</td>
		<td>
			<button class="btn btn-sm bg-[#222211] text-white">
				<span class="sm:hidden">+</span>
				<a class="hidden sm:contents" href="/liquidity/{pool.arc200Asset.symbol}/add">Add Liq</a>
			</button>
		</td>
	</tr>
{/if}

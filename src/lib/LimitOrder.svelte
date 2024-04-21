<script lang="ts">
	import { contracts, contractsConstants, type Token } from '$lib';
	import MdClose from 'svelte-star/dist/md/MdClose.svelte';
	import CurrencyNumber from './CurrencyNumber.svelte';
	import { LimitOrders001ClientConnector, LimitOrderType } from './LimitOrderConnector';
	import { connectedAccount } from './UseWallet.svelte';
	import { pageContentRefresh } from './utils';

	export let order: {
		orderId: number;
		name: Uint8Array;
		value: Uint8Array;
		maker: string;
		arc200Id: number;
		arc200Token: Token;
		algoAmount: number;
		arc200Amount: bigint;
		isDirectionFromArc200ToAlgo: number;
	};
	export let buy: boolean;

	async function cancelLimitOrder(e: MouseEvent, limitOrder: typeof order) {
		e.stopPropagation();
		const connector = new LimitOrders001ClientConnector(contracts.orderbookLimitOrderApp);

		if (limitOrder.maker === $connectedAccount) {
			await connector.invoke('deleteLimitOrder', limitOrder.orderId);
		}
		pageContentRefresh(0);
	}

	$: arc200TokenAmount = Number(order.arc200Amount) / order.arc200Token.unit;
	$: algoTokenAmouunt = Number(order.algoAmount) / 1e6;
</script>

<div
	class="w-full event p-2 px-2 sm:px-3 rounded flex justify-start items-center gap-1 max-w-[800px] hover:bg-[#ffffff20]"
>
	<span
		class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 flex font-mono"
		class:text-green-300={buy}
		class:text-red-400={!buy}
	>
		{(algoTokenAmouunt / arc200TokenAmount).toLocaleString('en')}
	</span>
	<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 flex">
		<CurrencyNumber amount={arc200TokenAmount} />
	</span>
	<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-10 sm:w-10 text-justify flex justify-end">
		{#if order.maker === $connectedAccount}
			<button
				class="btn btn-sm btn-ghost btn-square hover:bg-transparent w-6 h-6 rounded flex justify-center items-center"
				on:click={(e) => cancelLimitOrder(e, order)}
			>
				<span class="scale-[0.8]"><MdClose /></span>
			</button>
		{/if}
	</span>
</div>

<!-- <div class="w-full flex flex-col p-2 px-4 bg-base-200 relative">
	<div class="pool rounded-btn flex flex-col min-w-[100px] sm:min-w-[300px] w-full max-w-[800px]">
		<div
			class="flex justify-between cursor-pointer select-none"
			class:text-green-400={order.isDirectionFromArc200ToAlgo}
			class:text-red-400={!order.isDirectionFromArc200ToAlgo}
			on:click={() => onSelect()}
			on:keydown
		>
			<span class="mb-0 flex w-full gap-5">
				<span class="w-16">
					{(arc200TokenAmount / algoTokenAmouunt).toLocaleString('en')}
				</span>

				<span class="w-16">
					<CurrencyNumber amount={algoTokenAmouunt} />
				</span>

				<span class="w-16 text-right">
					<CurrencyNumber amount={arc200TokenAmount} />
				</span>
			</span>
		</div>
	</div>
</div> -->

<style>
	* {
		box-sizing: border-box;
	}
</style>

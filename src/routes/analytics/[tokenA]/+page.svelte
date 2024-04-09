<script lang="ts">
	import PoolChartContext from '$lib/PoolChartContext.svelte';
	import CurrencyNumber from '$lib/CurrencyNumber.svelte';
	import { timeAgo } from '$lib/utils';
	import { convertDecimals } from '$lib/numbers';
	import { lastActiveAnalyticsPair } from '$lib/stores';

	let moreSwapEvents = false;
	let moreDepositEvents = false;
	let eventsPageSize = 20;
</script>

<br /><br />
<PoolChartContext>
	<svelte:fragment slot="swap-events" let:arc200Token let:swapEvents let:getFromTokenFromEvent let:getToTokenFromEvent>
		{@const _a = (() => arc200Token.ticker && lastActiveAnalyticsPair.set(arc200Token.ticker))()}
		<div class="events flex flex-col gap-0 justify-center items-center w-full sm:w-[calc(100vw-400px)]">
			{#if swapEvents?.length}
				{@const someSwapEvents = [...swapEvents]
					.sort((a, b) => b.txn['confirmed-round'] - a.txn['confirmed-round'])
					.slice(0, moreSwapEvents ? 1_000_000 : eventsPageSize)}
				<div class="w-full event font-bold p-3 px-0 rounded-btn flex justify-start items-center gap-1 max-w-[800px]">
					<h4 class="text-lg text-left w-full mb-2 max-w-[724px]">Recent Txns</h4>
					<span class="flex-grow" />
				</div>
				<div
					class="w-full event bg-[#ffff6605] font-bold p-3 px-6 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
				>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28"> TxId </span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">Time</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">Round</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden min-[380px]:flex"> Sender </span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-left">From Amt.</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-left">To Amt.</span>
				</div>
				{#each someSwapEvents as event}
					{@const fromAmount = Number(event.fromAmount / getFromTokenFromEvent(event).unit)}
					{@const toAmount = Number(event.toAmount / getToTokenFromEvent(event).unit)}
					<div
						class="w-full event bg-[#ffff6605] hover:invert-[10%] p-2 px-6 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
					>
						<a
							class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28"
							href="https://voi.observer/explorer/transaction/{event.txn.id}"
							target="_blank"
							referrerpolicy="no-referrer"
						>
							{event.txn.id.slice(0, 3)}...{event.txn.id.slice(-3)}
						</a>
						<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">
							{timeAgo(event.txn['round-time'] * 1000)}
						</span>
						<a
							href="https://voi.observer/explorer/block/{event.txn['confirmed-round']}"
							target="_blank"
							referrerpolicy="no-referrer"
							class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex"
						>
							{event.txn['confirmed-round']}
						</a>
						<a
							class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden min-[380px]:flex"
							href="https://voi.observer/explorer/account/{event.sender}"
							target="_blank"
							referrerpolicy="no-referrer"
						>
							{event.sender.slice(0, 3)}...{event.sender.slice(-3)}
						</a>
						<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-justify">
							<CurrencyNumber amount={fromAmount} />
							{event.direction ? arc200Token.ticker : 'VOI'}
						</span>
						<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-justify">
							<CurrencyNumber amount={toAmount} />
							{event.direction ? 'VOI' : arc200Token.ticker}
						</span>
					</div>
				{/each}

				{#if swapEvents.length > eventsPageSize && (moreSwapEvents || swapEvents.length > someSwapEvents.length)}
					<button class="btn btn-sm btn-ghost mt-4" on:click={(e) => (moreSwapEvents = !moreSwapEvents)}>
						Show {moreSwapEvents ? 'Less' : 'More'}
					</button>
				{/if}
			{/if}
		</div>
	</svelte:fragment>

	<svelte:fragment slot="liquidity-events" let:arc200Token let:depositEvents>
		<div class="events flex flex-col gap-0 justify-center items-center w-full sm:w-[calc(100vw-400px)]">
			{#if depositEvents?.length}
				{@const someDepositEvents = [...depositEvents]
					.sort((a, b) => b.txn['confirmed-round'] - a.txn['confirmed-round'])
					.slice(0, moreDepositEvents ? 1_000_000 : eventsPageSize)}
				<div class="w-full event font-bold p-3 px-0 rounded-btn flex justify-start items-center gap-1 max-w-[800px]">
					<h4 class="text-lg text-left w-full mb-2 max-w-[724px]">Add/Remove Liquidity</h4>
					<span class="flex-grow" />
				</div>
				<div
					class="w-full event bg-[#ffff6605] font-bold p-3 px-6 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
				>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28"> TxId </span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">Time</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">Round</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden min-[380px]:flex"> Sender </span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-left">Amt.</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-left">Amt.</span>
				</div>
				{#each someDepositEvents as event}
					{@const voiAmount = Number(convertDecimals(event.amts[0], 6, 6)) / 1e6}
					{@const arc200Amount = Number(convertDecimals(event.amts[1], arc200Token.decimals, 6)) / 1e6}
					{@const changeSign = event.adding ? '+' : '-'}
					<div
						class="w-full event bg-[#ffff6605] hover:invert-[10%] p-2 px-6 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
					>
						<a
							class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28"
							href="https://voi.observer/explorer/transaction/{event.txn.id}"
							target="_blank"
							referrerpolicy="no-referrer"
						>
							{event.txn.id.slice(0, 3)}...{event.txn.id.slice(-3)}
						</a>
						<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">
							{timeAgo(event.txn['round-time'] * 1000)}
						</span>
						<a
							href="https://voi.observer/explorer/block/{event.txn['confirmed-round']}"
							target="_blank"
							referrerpolicy="no-referrer"
							class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex"
						>
							{event.txn['confirmed-round']}
						</a>
						<a
							class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden min-[380px]:flex"
							href="https://voi.observer/explorer/account/{event.sender}"
							target="_blank"
							referrerpolicy="no-referrer"
						>
							{event.sender.slice(0, 3)}...{event.sender.slice(-3)}
						</a>
						<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-justify">
							{changeSign}<CurrencyNumber amount={voiAmount} />
							VOI
						</span>
						<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-justify">
							{changeSign}<CurrencyNumber amount={arc200Amount} />
							{arc200Token.ticker}
						</span>
					</div>
				{/each}

				{#if depositEvents.length > eventsPageSize && (moreDepositEvents || depositEvents.length > someDepositEvents.length)}
					<button class="btn btn-sm btn-ghost mt-4" on:click={(e) => (moreDepositEvents = !moreDepositEvents)}>
						Show {moreDepositEvents ? 'Less' : 'More'}
					</button>
				{/if}
			{/if}
		</div>
		<br />
		<br />
		<br />
	</svelte:fragment>
</PoolChartContext>

<style>
	.event {
		margin-bottom: 0.5rem;
	}
</style>

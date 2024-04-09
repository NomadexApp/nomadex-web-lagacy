<script lang="ts">
	import { getStores } from '$app/stores';
	import { knownPools, type Pool } from '$lib';
	import FormTitle from '$lib/components/form/FormTitle.svelte';
	import TextInput from '$lib/components/form/TextInput.svelte';
	import { getDepositEvents } from '$lib/events';

	const { page } = getStores();

	let searchText = '';

	import PoolInfo from '$lib/PoolInfo.svelte';
	import PoolPosition from '$lib/PoolPosition.svelte';
	import { onChainStateWatcher, watchArc200Balance, watchPoolTotalSupply } from '$lib/stores/onchain';
	import { connectedAccount } from '$lib/UseWallet.svelte';
	import algosdk from 'algosdk';
	import { writable, derived, get } from 'svelte/store';

	let hasPosition = false;
	let showMore = false;

	const sortedPools = writable<(Pool & { balances: { [k: string]: any } })[]>([]);

	function update(pool: Pool) {
		const poolState = onChainStateWatcher.getAccountWatcher(algosdk.getApplicationAddress(pool.poolId));
		const poolArc200Balance = watchArc200Balance(pool.arc200Asset.assetId, algosdk.getApplicationAddress(pool.poolId));
		const poolTotalSupply = watchPoolTotalSupply(pool.poolId);

		$sortedPools = [
			...$sortedPools,
			{
				...pool,
				balances: {
					algo: derived(poolState, (state) => state.amount),
					arc200: derived(poolArc200Balance, (state) => state),
					lpt: derived(poolTotalSupply, (state) => state),
				},
			},
		];

		const unsub = poolState.subscribe((v) => {
			$sortedPools = [...$sortedPools];
			setTimeout(() => {
				if (v.amount) unsub();
			});
		});
		const unsub1 = poolArc200Balance.subscribe((v) => {
			$sortedPools = [...$sortedPools];
			setTimeout(() => {
				if (v) unsub1();
			});
		});
		const unsub2 = poolTotalSupply.subscribe((v) => {
			$sortedPools = [...$sortedPools];
			setTimeout(() => {
				if (v) unsub2();
			});
		});
	}

	$: {
		$sortedPools = [];
		for (const pool of $knownPools) {
			update(pool);
		}
	}

	$: filteredPools = searchText
		? $sortedPools.filter(
				(pool) =>
					pool.arc200Asset.symbol.toLowerCase().match(searchText.toLowerCase()) ||
					pool.arc200Asset.assetId.toString() === searchText ||
					pool.poolId.toString() === searchText
		  )
		: $sortedPools;
</script>

<form class="max-w-[90vw] overflow-hidden">
	<FormTitle>Liquidity Pools</FormTitle>
	<p>
		Liquidity providers earn a fee on all trades proportional to their share of the pool. Fees are added to the pool,
		accrue in real time and can be claimed by removing your liquidity.
	</p>
	<br />

	{#if $connectedAccount}
		<div class="join sm:grid sm:grid-cols-2">
			<a
				href="/pool"
				class="join-item btn hover:outline-none btn-outline text-[#ffffdd] hover:bg-[#ffff66]"
				class:active={$page.url.pathname.match(/\/pool\/?$/)}>Pools</a
			>
			<a
				href="/pool/your-positions"
				class="join-item btn hover:outline-none btn-outline text-[#ffffdd] hover:bg-[#ffff66]"
				class:active={$page.url.pathname.match(/\/pool\/your-positions\/?/)}>Your Positions</a
			>
		</div>
		<br />
	{/if}
	<br class="sm:hidden" />

	{#if $page.url.pathname.match(/\/pool\/?$/)}
		<h3 class="text-xl mb-2">Search pool</h3>
		<TextInput placeholder="Search by name or id" bind:value={searchText} />
		<br />
		<h3 class="text-xl mb-2">Popular pools</h3>
	{/if}

	<div class="pools mb-8 text-base">
		<div class="pools-head mb-2 text-sm justify-between bg-[#ffff6605] hover:bg-[#ffff6611] rounded p-2 cursor-pointer">
			<th class="flex-grow-[1.2]"> Name </th>
			<th class="flex-grow w-20"> TVL </th>
			<th class="flex-grow hidden sm:inline-block pl-2"> APR </th>
			<th class="flex-grow"> &nbsp; </th>
		</div>
		{#each filteredPools.sort((pool, pool1) => Number(get(pool1.balances.algo)) - Number(get(pool.balances.algo))) as pool (pool.poolId)}
			<PoolInfo {pool} checkForLpt={Boolean($page.url.pathname.match(/\/pool\/your-positions$/))} />
		{/each}
	</div>
</form>
<br />
<br />
<br />
<br />
<br />

<slot />

<!-- <div class="buttons">
	<ActionButton on:click={() => close()}>Close</ActionButton>
</div> -->

<style>
	form {
		margin: 0 auto;
		margin-top: 50px;
		width: 700px;
	}

	.pools {
		display: flex;
		flex-direction: column;
	}

	.pools-head {
		display: flex;
		justify-content: space-between;
	}

	.join-item.active {
		color: #000000;
		background: #ffff66;
	}
</style>

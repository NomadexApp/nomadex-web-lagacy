<script lang="ts">
	import { getStores } from '$app/stores';
	import { knownPools, type Pool } from '$lib';
	import FormTitle from '$lib/components/form/FormTitle.svelte';
	import TextInput from '$lib/components/form/TextInput.svelte';
	import Join from '$lib/components/join/Join.svelte';

	const { page } = getStores();

	let searchText = '';

	import PoolInfo from '$lib/PoolInfo.svelte';
	import { onChainStateWatcher, watchArc200Balance, watchPoolTotalSupply } from '$lib/stores/onchain';
	import { connectedAccount } from '$lib/UseWallet.svelte';
	import algosdk from 'algosdk';
	import { writable, derived, get } from 'svelte/store';

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

	const popularPools = ['VIA', 'ROCKET', 'pix', 'VWIFI', 'Tacos', 'Voice'];
	$: my = Boolean($page.url.pathname.match('/your-positions'));
	$: all = Boolean($page.url.pathname.match('/pool/all'));

	$: filteredPools = searchText
		? $sortedPools.filter(
				(pool) =>
					pool.arc200Asset.symbol.toLowerCase().match(searchText.toLowerCase()) ||
					pool.arc200Asset.assetId.toString() === searchText ||
					pool.poolId.toString() === searchText
		  )
		: $sortedPools.filter((pool) =>
				popularPools.length && !my && !all ? popularPools.includes(pool.arc200Asset.symbol) : true
		  );
</script>

<form class="max-w-[90vw] overflow-hidden">
	<FormTitle>Liquidity Pools</FormTitle>
	{#if !all}
		<p>
			Liquidity providers earn a fee on all trades proportional to their share of the pool. Fees are added to the pool,
			accrue in real time and can be claimed by removing your liquidity.
		</p>
		<div class="br" />

		{#if $connectedAccount}
			<Join
				items={[
					{ id: 'pools', name: 'Pools', href: '/pool' },
					{ id: 'your-positions', name: 'Your Positions', href: '/pool/your-positions' },
				]}
				active={$page.url.pathname.match(/\/pool\/your-positions\/?/) ? 'your-positions' : 'pools'}
			/>
			<div class="br" />
		{/if}
	{:else}
		<div class="br" />
	{/if}
	<br class="sm:hidden" />

	{#if $page.url.pathname.match(/\/pool\/?$/)}
		<h3 class="text-xl mb-2">Search pool</h3>
		<TextInput placeholder="Search by name or id" bind:value={searchText} />
		<div class="br" />
		<h3 class="text-xl mb-2">Popular pools</h3>
	{/if}

	<div class="pools mb-8 text-base sm:bg-[#00000033] sm:rounded-[8px] flex flex-col gap-2">
		<div class="pool hidden sm:grid">
			<div>Name</div>
			<div>{my ? 'Value' : 'TVL'}</div>
			<div class="inline-flex items-start">VOL<span class="text-xs -mt-1 text-gray-300">7d</span></div>
			<div>APR</div>
			<div>&nbsp;</div>
		</div>

		{#each filteredPools.sort((pool, pool1) => Number(get(pool1.balances.algo)) - Number(get(pool.balances.algo))) as pool (pool.poolId)}
			<PoolInfo {pool} {my} checkForLpt={Boolean($page.url.pathname.match(/\/pool\/your-positions$/))} />
		{/each}
	</div>
</form>
{#if !my && !all}
	<div class="flex justify-center">
		<a href="/pool/all"><button class="btn btn-ghost">All Pools</button></a>
	</div>
{/if}
<div class="br" />
<div class="br" />
<div class="br" />
<div class="br" />
<div class="br" />

<slot />

<style>
	form {
		margin: 0 auto;
		margin-top: 50px;
		width: 800px;
	}

	.pools {
		backdrop-filter: blur(5px);
	}

	.pools > :global(.pool) {
		grid-template-columns: minmax(100px, 1fr) minmax(50px, 150px) minmax(50px, 150px) minmax(50px, 75px) 120px;
		padding: 0.5rem;
	}

	.pools > :global(.pool) > :global(*) {
		padding: 0.5rem;
	}
</style>

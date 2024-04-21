<script lang="ts">
	import type { Token } from '$lib';
	import { connectedAccount } from '$lib/UseWallet.svelte';
	import { getArc200Balance } from '$lib/_shared';
	import { convertDecimals } from '$lib/numbers';
	import ActionButton from '../form/ActionButton.svelte';
	import TextInput from '../form/TextInput.svelte';

	export let close: Function;
	export let tokens: Token[] = [];
	export let handleSelect: (token: Token) => void = () => {};

	let tokenSearch = '';
	let filteredTokens: Token[] = [];

	let balances = {};

	$: filteredTokens = tokenSearch
		? tokens.filter(
				(token) =>
					token.id.toString() === tokenSearch ||
					token.ticker.toLowerCase().match(new RegExp(`^${tokenSearch.toLowerCase()}`))
		  )
		: tokens;

	$: $connectedAccount && getBalances(filteredTokens);

	async function getBalances(tokens: Token[]) {
		for (const token of tokens) {
			if ($connectedAccount && typeof balances[token.id] !== 'number') {
				const balance = await getArc200Balance(token.id, $connectedAccount);
				balances[token.id] = balance;
			}
		}
	}
</script>

<form>
	<h3 class="text-2xl mb-4">Select a token</h3>
	<TextInput placeholder="Search by name or id" bind:value={tokenSearch} />
	<div class="br" />
	<span class="block text-xl mb-4">
		{#if tokenSearch}Matched{:else}Popular{/if} tokens
	</span>
	<div class="tokens flex flex-col gap-2 mb-4 overflow-y-auto max-h-96">
		{#each filteredTokens.sort((token) => (balances[token.id] ? -1 : 1)) as token}
			<div
				on:keydown
				class="token flex gap-4 bg-[#f0f0f005] hover:bg-[#f0f0f010] rounded p-2 cursor-pointer"
				on:click={() => {
					close();
					handleSelect(token);
				}}
			>
				<div class="icon avatar w-10 h-10 bg-[#f0f0f005] rounded-full flex justify-center items-center">?</div>
				<div class="flex flex-col text-sm flex-grow">
					<span class="name">{token.ticker}</span>
					<span class="symbol text-gray-200">{token.id}</span>
				</div>
				{#if balances[token.id]}
					<div>
						{(Number(convertDecimals(balances[token.id] ?? 0, token.decimals, 6)) / 1e6).toLocaleString()}
						{token.ticker}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</form>

<div class="buttons">
	<button class="btn btn-ghost w-full" on:click={() => close()}>Close</button>
</div>

<style>
	form {
		width: 100vw;
		max-width: calc(500px - 2rem);
		overflow: hidden;
	}
	.tokens {
		display: flex;
		flex-direction: column;
	}

	.token {
		display: flex;
	}
</style>

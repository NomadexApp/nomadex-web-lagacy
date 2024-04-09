<script lang="ts">
	import type { Token } from '$lib';
	import ActionButton from '../form/ActionButton.svelte';
	import TextInput from '../form/TextInput.svelte';

	export let close: Function;
	export let tokens: Token[] = [];
	export let handleSelect: (token: Token) => void = () => {};

	let tokenSearch = '';

	$: filteredTokens = tokenSearch
		? tokens.filter(
				(token) =>
					token.id.toString() === filteredTokens ||
					token.ticker.toLowerCase().match(new RegExp(`^${tokenSearch.toLowerCase()}`))
		  )
		: tokens;
</script>

<form>
	<h3 class="text-2xl mb-4">Select a token</h3>
	<TextInput placeholder="Search by name or id" bind:value={tokenSearch} />
	<br />
	<span class="block text-xl mb-4">
		{#if tokenSearch}Matched{:else}Popular{/if} tokens
	</span>
	<div class="tokens flex flex-col gap-2 mb-4 overflow-y-auto max-h-96">
		{#each filteredTokens as token}
			<div
				on:keydown
				class="token flex gap-4 bg-[#ffff6605] hover:bg-[#ffff6611] rounded p-2 cursor-pointer"
				on:click={() => {
					close();
					handleSelect(token);
				}}
			>
				<div class="icon avatar w-10 h-10 bg-[#666633] rounded-full flex justify-center items-center">?</div>
				<div class="flex flex-col text-sm">
					<span class="name">{token.ticker}</span>
					<span class="symbol text-gray-200">{token.id}</span>
				</div>
			</div>
		{/each}
	</div>
</form>

<div class="buttons">
	<ActionButton on:click={() => close()}>Close</ActionButton>
</div>

<style>
	form {
		width: min(350px, calc(100vw - 5rem));
		max-width: 400px;
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

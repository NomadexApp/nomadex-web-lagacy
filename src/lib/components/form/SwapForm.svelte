<script lang="ts">
	import TokenInput from '$lib/components/form/TokenInput.svelte';
	import ActionButton from '$lib/components/form/ActionButton.svelte';
	import FormTitle from '$lib/components/form/FormTitle.svelte';
	import SwapInfo from '$lib/components/form/SwapInfo.svelte';
	import SelectTokenModal from '$lib/components/modal/SelectTokenModal.svelte';
	import { openModal } from '../modal/Modal.svelte';
	import MdSwapVert from 'svelte-star/dist/md/MdSwapVert.svelte';
	import { knownTokens, type Token } from '$lib';
	import { readableNumber } from '$lib/CurrencyNumber.svelte';
	import { connectedAccount } from '$lib/UseWallet.svelte';

	export let tokenABalance: number | bigint = 0n;
	export let tokenBBalance: number | bigint = 0n;
	export let poolTokenABalance: number | bigint = 0n;
	export let poolTokenBBalance: number | bigint = 0n;
	export let minReceived = 0;
	export let tokenAInput = 0;
	export let tokenBInput = 0;
	export let slippage = 1;
	export let slippagePercent = slippage * 100;
	export let impact = 1;
	export let tokenA: Token;
	export let tokenB: Token;
	export let disabled = false;
	export let onInputTokenA = () => {};
	export let onInputTokenB = () => {};
	export let handleSwitchPlaces = () => {};
	export let handleSwap = () => {};
	export let handleTokenChange: (token: Token, index: number) => void = () => {};

	let editingSlippage = false;
</script>

<div class="form">
	<FormTitle>Swap VOI for VIA</FormTitle>
	<TokenInput
		pretext="You pay"
		posttext={`balance ${tokenABalance.toLocaleString()} ${tokenA.ticker}`}
		token={tokenA.ticker}
		showMax
		bind:value={tokenAInput}
		on:keydown={(e) => disabled && e.preventDefault()}
		on:keyup={onInputTokenA}
		handleMax={() => {
			tokenAInput = tokenAInput === Number(tokenABalance) ? 0 : Number(tokenABalance);
			onInputTokenA();
		}}
		on:click={() => {
			if (tokenA.id === 0) return;
			openModal(SelectTokenModal, {
				tokens: $knownTokens.filter((tok) => tok.id && tok.id !== tokenA.id),
				handleSelect(token) {
					handleTokenChange(token, 0);
				},
			});
		}}
	/>
	<div class="flex justify-center px-1">
		<button
			type="reset"
			class="btn btn-ghost btn-link btn-sm opacity-80 text-base-content"
			on:click={handleSwitchPlaces}
		>
			<span class="block h-6"><MdSwapVert /></span>
		</button>
	</div>
	<TokenInput
		pretext="You receive"
		token={tokenB.ticker}
		posttext={`balance ${tokenBBalance.toLocaleString()} ${tokenB.ticker}`}
		bind:value={tokenBInput}
		on:keydown={(e) => disabled && e.preventDefault()}
		on:keyup={onInputTokenB}
		on:click={() => {
			if (tokenB.id === 0) return;
			openModal(SelectTokenModal, {
				tokens: $knownTokens.filter((tok) => tok.id && tok.id !== tokenB.id),
				handleSelect(token) {
					handleTokenChange(token, 1);
				},
			});
		}}
	/>

	<div class="flex justify-end items-center gap-2 text-[#999966]">
		<div class="text-[0.8rem] text-[#999966]">Slippage</div>
		<div on:click={() => (editingSlippage = true)} on:keydown>
			<input
				type="number"
				class="no-arrows bg-[#333311] outline-none p-[1px] px-[2px] text-[0.9rem] w-[3rem] text-center rounded"
				step={0.01}
				bind:value={slippagePercent}
				placeholder="1%"
				on:blur={() => {
					slippage = slippagePercent / 100;
					editingSlippage = false;
					onInputTokenA();
				}}
			/> %
		</div>
	</div>

	<ActionButton on:click={handleSwap} disabled={Boolean($connectedAccount) && disabled}>
		{#if $connectedAccount}
			Swap
		{:else}
			Connect to a Wallet
		{/if}
	</ActionButton>

	<SwapInfo
		data={[
			[
				'Pool balance',
				`${readableNumber(Number(poolTokenABalance ?? 0)).toLocaleString()} ${tokenA.ticker} / ${readableNumber(
					Number(poolTokenBBalance) || 0
				).toLocaleString()} ${tokenB.ticker}`,
			],
			['Min received', `${minReceived.toLocaleString()} ${tokenB.ticker}`],
			['Price impact', `${impact}%`],
			['Slippage', `${slippage * 100}%`],
			['Fee', '1%'],
		]}
	/>
</div>

<style>
	.form {
		background-color: var(--primary-color);
		margin: 100px auto 0 auto;
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
	input:focus-within {
		color: white;
	}
</style>

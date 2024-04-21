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
	import { convertDecimals } from '$lib/numbers';

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

	let swapInfo: [string, string][] = [];

	$: swapInfo = [
		[
			'Pool balance',
			`${readableNumber(Number(poolTokenABalance ?? 0)).toLocaleString()} ${tokenA.ticker} / ${readableNumber(
				Number(poolTokenBBalance) || 0
			).toLocaleString()} ${tokenB.ticker}`,
		],
		['Min received', `${minReceived.toLocaleString()} ${tokenB.ticker}`],
		['Price impact', `${impact}%`],
		['Slippage', `${slippage * 100}%`],
		...(tokenAInput && tokenBInput
			? [
					<[string, string]>[
						'Price',
						`1 ${tokenA.ticker} = ${Number(
							(
								Number(convertDecimals(Math.floor((tokenBInput || 0) * 1e6), tokenB.decimals, 6)) /
								Number(convertDecimals(Math.floor((tokenAInput || 0) * 1e6), tokenA.decimals, 6))
							).toFixed(4)
						)} ${tokenB.ticker}`,
					],
					<[string, string]>['Fee', `${Number(((tokenBInput || 0) * 0.01).toFixed(4))} ${tokenB.ticker}`],
			  ]
			: []),
		['Fee %', '1%'],
	];
</script>

<div class="form pt-8">
	<FormTitle>Swap {tokenA.ticker} for {tokenB.ticker}</FormTitle>
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
		<button type="reset" class="btn btn-ghost btn-link text-white btn-sm opacity-80" on:click={handleSwitchPlaces}>
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

	<div class="flex justify-end items-center gap-2 text-[#999999]">
		<div class="text-[0.8rem] text-[#f0f0f0aa]">Slippage</div>
		<div on:click={() => (editingSlippage = true)} on:keydown>
			<input
				type="number"
				class="no-arrows bg-[#00000040] outline-none p-[1px] px-[2px] text-[0.9rem] w-[3rem] text-center rounded"
				min={0.01}
				max={40}
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

	<SwapInfo data={swapInfo} />
</div>

<style>
	.form {
		margin: 5rem auto 0 auto;
		height: max-content;
		padding: 2rem;
		backdrop-filter: blur(5px);
		background: #00000040;
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

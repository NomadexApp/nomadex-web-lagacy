<script lang="ts">
	import { type Token, knownTokens, TokenType, knownPools, type Pool } from '$lib';
	import { getStores } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { calculateInTokens, calculateOutTokens } from '$lib/howMuch';
	import { connectedAccount } from '$lib/UseWallet.svelte';
	import { pageContentRefresh } from '$lib/utils';
	import { onChainStateWatcher, watchArc200Balance } from '$lib/stores/onchain';
	import algosdk from 'algosdk';
	import { AlgoArc200PoolConnector } from '$lib/AlgoArc200PoolConnector';
	import { convertDecimals } from '$lib/numbers';
	import { lastActiveSwapPair } from '$lib/stores';
	import SwapForm from '$lib/components/form/SwapForm.svelte';
	import { openModal } from '$lib/components/modal/Modal.svelte';
	import ConnectWallet from '$lib/components/modal/ConnectWallet.svelte';

	const { page } = getStores();
	const tokenA = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenA);
	const tokenB = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenB);

	let voiToken: Token = <any>undefined;
	let arc200Token: Token = <any>undefined;
	let matchedPool: Pool = <any>undefined;

	if (tokenA?.ticker === 'VOI' && tokenB?.type === TokenType.ARC200) {
		voiToken = tokenA;
		arc200Token = tokenB;
	} else if (tokenB?.ticker === 'VOI' && tokenA?.type === TokenType.ARC200) {
		voiToken = tokenB;
		arc200Token = tokenA;
	} else if (browser) {
		goto(`/`);
	}

	if (voiToken && arc200Token) {
		const match = $knownPools.find((pool) => pool.arc200Asset.assetId === arc200Token.id);
		if (match) matchedPool = match;
	}

	if (!matchedPool) {
		throw Error('pool not found');
	}

	if (tokenA.ticker && tokenB.ticker) {
		lastActiveSwapPair.set(`${tokenA.ticker}-${tokenB.ticker}`);
	}

	let tokens: [Token, Token] | undefined = [tokenA, tokenB];

	let slippage = browser ? JSON.parse(localStorage.getItem('slippage') ?? '0.025') : 0.025;

	$: browser && localStorage.setItem('slippage', JSON.stringify(slippage));

	const connectedUserState = onChainStateWatcher.getAccountWatcher($connectedAccount);
	const currentPoolState = onChainStateWatcher.getAccountWatcher(algosdk.getApplicationAddress(matchedPool.poolId));

	const userArc200Balance = watchArc200Balance(arc200Token.id, $connectedAccount);
	const poolArc200Balance = watchArc200Balance(arc200Token.id, algosdk.getApplicationAddress(matchedPool.poolId));

	$: loaded = $poolArc200Balance && $currentPoolState.amount;

	function setSelectedToken(token: Token, index: number) {
		if (index === 0) {
			if (tokenA.ticker !== token.ticker) {
				updateRoute(token, tokenB);
			}
		} else {
			if (tokenB.ticker !== token.ticker) {
				updateRoute(tokenA, token);
			}
		}
	}

	function updateRoute(aToken: Token, bToken: Token) {
		if (aToken.ticker !== tokenA.ticker || bToken.ticker !== tokenB.ticker) {
			goto(`/swap/${aToken.ticker}-${bToken.ticker}`, { replaceState: true });
			pageContentRefresh(0);
		}
	}

	$: browser && tokens && tokenA && tokenB && updateRoute(tokenA, tokenB);

	let inputTokenA: number = 0;
	let inputTokenB: number = 0;
	let disabled = true;
	let loading = false;

	let timeout: NodeJS.Timeout;

	async function onInputTokenA() {
		if (!tokenA || !tokenB) return;
		clearTimeout(timeout);
		disabled = true;
		inputTokenB = 0;
		if (!inputTokenA || typeof inputTokenA !== 'number') return;
		let tm: NodeJS.Timeout | undefined;
		await new Promise((r) => {
			timeout = setTimeout(r, 500);
			tm = timeout;
		});
		loading = true;
		const poolVoiBalance = BigInt($currentPoolState.amount) - BigInt($currentPoolState['min-balance'] ?? 0n);
		const poolViaBalance = $poolArc200Balance ?? 0n;
		const ret = calculateOutTokens(
			BigInt(Math.floor(inputTokenA * tokenA.unit)),
			tokenA.ticker === 'VOI' ? poolVoiBalance : poolViaBalance,
			tokenA.ticker === 'VOI' ? poolViaBalance : poolVoiBalance,
			BigInt(matchedPool.swapFee)
		);
		loading = false;
		if (tm && tm === timeout) {
			inputTokenB = Number((Number(ret) / tokenB.unit).toFixed(6));
			disabled = !inputTokenB;
		}
	}

	async function onInputTokenB() {
		if (!tokenA || !tokenB) return;
		clearTimeout(timeout);
		disabled = true;
		inputTokenA = 0;
		if (!inputTokenB || typeof inputTokenB !== 'number') return;
		let tm: NodeJS.Timeout | undefined;
		await new Promise((r) => {
			timeout = setTimeout(r, 500);
			tm = timeout;
		});
		loading = true;
		const poolVoiBalance = BigInt($currentPoolState.amount) - BigInt($currentPoolState['min-balance'] ?? 0n);
		const poolViaBalance = $poolArc200Balance ?? 0n;
		const ret = calculateInTokens(
			BigInt(Math.floor(inputTokenB * tokenB.unit)),
			tokenA.ticker === 'VOI' ? poolVoiBalance : poolViaBalance,
			tokenA.ticker === 'VOI' ? poolViaBalance : poolVoiBalance,
			BigInt(matchedPool.swapFee)
		);
		loading = false;
		if (tm && tm === timeout) {
			inputTokenA = Number((Number(ret) / tokenA.unit).toFixed(6));
			disabled = !inputTokenB;
		}
	}

	async function swap() {
		if (!tokenA || !tokenB) return;
		const prev = disabled;
		disabled = true;

		const tokenAAmount = Math.floor(inputTokenA * tokenA.unit);
		const tokenBAmount = Math.floor(inputTokenB * tokenB.unit);
		const minOfTokenB = Math.floor(tokenBAmount - Math.round(tokenBAmount * slippage));

		const algoArc200PoolConnector = new AlgoArc200PoolConnector(matchedPool.arc200Asset.assetId, matchedPool.poolId);

		if (tokenA.ticker === voiToken.ticker && tokenB.ticker === arc200Token.ticker) {
			await algoArc200PoolConnector.invoke('swapVoiToArc200', BigInt(tokenAAmount), BigInt(minOfTokenB));
			pageContentRefresh(0);
		} else if (tokenA.ticker === arc200Token.ticker && tokenB.ticker === voiToken.ticker) {
			await algoArc200PoolConnector.invoke('swapArc200ToVoi', BigInt(tokenAAmount), BigInt(minOfTokenB));
			pageContentRefresh(0);
		}
		disabled = prev;
	}

	const getTokenSuggestions = (token: Token) => {
		if (token.type === TokenType.ARC200) {
			return $knownPools.map((pool) => ({
				name: pool.arc200Asset.symbol,
				value: $knownTokens.find((token) => token.id === pool.arc200Asset.assetId),
			}));
		}
	};

	$: poolTokenABalance = ($currentPoolState.amount - ($currentPoolState['min-balance'] ?? 0)) / voiToken.unit;
	$: poolTokenBBalance = Number($poolArc200Balance) / matchedPool.arc200Asset.unit;

	$: formData = {
		tokenABalance:
			tokenA.ticker === arc200Token.ticker
				? $userArc200Balance
				: BigInt(Math.max(0, $connectedUserState.amount - (($connectedUserState['min-balance'] ?? 0) + 100_000))),
		tokenBBalance:
			tokenB.ticker === arc200Token.ticker
				? $userArc200Balance
				: BigInt(Math.max(0, $connectedUserState.amount - (($connectedUserState['min-balance'] ?? 0) + 100_000))),
	};

	let impact = 0;

	$: impact = Number(
		(
			((poolTokenABalance * 0.99 + inputTokenA) /
				(poolTokenBBalance - inputTokenB) /
				((poolTokenABalance * 0.99) / poolTokenBBalance) -
				1) *
				100 || 0
		).toFixed(2)
	);

	let lastPoolArc200Balance = 0n;
	let lastPoolAlgoBalance = 0;
	$: if (
		$poolArc200Balance &&
		$currentPoolState.amount &&
		inputTokenA &&
		($poolArc200Balance !== lastPoolArc200Balance || $currentPoolState.amount !== lastPoolAlgoBalance)
	) {
		onInputTokenA();
		lastPoolArc200Balance = $poolArc200Balance;
		lastPoolAlgoBalance = $currentPoolState.amount;
	}
</script>

{#if voiToken && arc200Token}
	<SwapForm
		disabled={!loaded || !inputTokenB || !inputTokenA}
		tokenABalance={Number(convertDecimals(formData.tokenABalance ?? 0n, tokenA.decimals, 6)) / 1e6}
		tokenBBalance={Number(convertDecimals(formData.tokenBBalance ?? 0n, tokenB.decimals, 6)) / 1e6}
		{poolTokenABalance}
		{poolTokenBBalance}
		minReceived={inputTokenB - inputTokenB * slippage}
		{impact}
		bind:tokenAInput={inputTokenA}
		bind:tokenBInput={inputTokenB}
		bind:slippage
		{tokenA}
		{tokenB}
		{onInputTokenA}
		{onInputTokenB}
		handleSwitchPlaces={() => {
			if (!tokens) return;
			updateRoute(tokenB, tokenA);
		}}
		handleSwap={() => ($connectedAccount ? (disabled ? null : swap()) : openModal(ConnectWallet, {}))}
		handleTokenChange={(token, index) => setSelectedToken(token, index)}
	/>
{:else}
	<h3>Token Not Found</h3>
{/if}

<style>
	@keyframes fadein {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>

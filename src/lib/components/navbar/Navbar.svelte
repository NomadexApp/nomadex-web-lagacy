<script lang="ts">
	import Logo from '$lib/components/logo/Logo.svelte';
	import MdAccountBalanceWallet from 'svelte-star/dist/md/MdAccountBalanceWallet.svelte';
	import { getStores } from '$app/stores';
	import { connectedAccount, walletDisconnect } from '$lib/UseWallet.svelte';
	import { openModal } from '../modal/Modal.svelte';
	import ConnectWallet from '$lib/components/modal/ConnectWallet.svelte';
	import { getLastActivePair } from '$lib/config';
	import { lastActiveAnalyticsPair, lastActiveLimitOrderPair, lastActiveSwapPair } from '$lib/stores';
	import { addNotification } from '$lib/Notify.svelte';
	import { getAccountBalance, watchArc200Balance } from '$lib/stores/onchain';

	const { page } = getStores();
</script>

<div class="navbar-wrapper">
	<nav class="navbar flex flex-col sm:flex-row">
		<div class="navbar-brand">
			<div class="logo-wrapper">
				<a href="/"><Logo /></a>
			</div>
		</div>
		<div class="space hidden sm:block" />
		<ul>
			<li class="first">
				<a
					class:active={$page.url.pathname.startsWith('/swap/')}
					href="/swap/{getLastActivePair('swap', $lastActiveSwapPair)}"
				>
					Swap
				</a>
			</li>

			<li>
				<a class:active={$page.url.pathname.startsWith('/pool')} href="/pool">Pool</a>
			</li>

			<li>
				<a
					class:active={$page.url.pathname.startsWith('/limit')}
					href="/limit/{getLastActivePair('limit', $lastActiveLimitOrderPair)}"
				>
					Limit
				</a>
			</li>

			<li>
				<a
					class:active={$page.url.pathname.startsWith('/analytics')}
					href="/analytics/{getLastActivePair('analytics', $lastActiveAnalyticsPair)}"
				>
					Analytics
				</a>
			</li>

			<li>
				<a href="https://v01.nomadex.app" target="_blank">v0.1</a>
			</li>
		</ul>
		<div class="actions flex gap-2">
			<!-- <UseWallet /> -->
			{#if $connectedAccount}
				<span class="text-black flex flex-col items-end bg-[#22221100] p-2 rounded text-sm cursor-default">
					{#await getAccountBalance($connectedAccount)}
						<span class="text-nowrap">0 VOI</span>
					{:then balance}
						<span class="text-nowrap">{(balance / 1e6).toLocaleString()} VOI</span>
					{/await}
					<span
						class="font-bold"
						on:keydown
						on:click={() => {
							navigator.clipboard.writeText($connectedAccount);
							addNotification('info', 'Copied to clipboard', 1000);
						}}
					>
						{$connectedAccount.slice(0, 3)}...{$connectedAccount.slice(-3)}
					</span>
				</span>
				<button class="btn bg-black hover:bg-[#222205]" on:click={() => walletDisconnect()}>
					<span class="inline-block h-6 w-6"><MdAccountBalanceWallet /></span>
					Disconnect
				</button>
			{:else}
				<button class="btn bg-black hover:bg-[#222205]" on:click={() => openModal(ConnectWallet, {})}>
					<span class="inline-block h-6 w-6"><MdAccountBalanceWallet /></span>
					Connect Wallet
				</button>
			{/if}
		</div>
	</nav>
</div>

<style>
	.navbar-wrapper {
		--height: 100px;
		width: 100vw;
		--edge-height: 300px;
		--edge-width: 0.2rem;
		height: calc(var(--height) + var(--edge-height));
		background: linear-gradient(to bottom, var(--primary-color) var(--height), #333333);
		position: fixed;
		top: 0;
		z-index: 1000;
		clip-path: polygon(
			0 0,
			100% 0,
			100% 100%,
			calc(100% - var(--edge-width)) calc(100% - var(--edge-height)),
			var(--edge-width) calc(100% - var(--edge-height)),
			0 100%
		);
	}

	@media (max-width: 700px) {
		:global(html body) {
			padding-top: 0;
		}
		.navbar-wrapper {
			position: relative;
			--height: 350px;
			--edge-height: 50px;
		}

		ul {
			flex-wrap: wrap;
			justify-content: center;
		}
		.actions {
			flex-direction: column;
			justify-content: center;
			margin-left: 0 !important;
		}
		.actions > span {
			display: flex;
			justify-content: center;
			align-items: center;
		}
	}

	.navbar {
		height: var(--height);
		overflow: hidden;
		max-width: 1500px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		padding: 1rem;
		gap: 1rem;
		overflow-x: auto;
	}

	.logo-wrapper {
		width: 2rem;
	}

	.logo-wrapper a {
		color: var(--secondary-color);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		gap: 0.5rem;
		margin-left: -0rem;
		align-items: center;
	}

	.space {
		margin: 0 0rem;
		width: 5px;
		height: 5px;
		border: 2px solid black;
		border-radius: 8px;
		/* animation: animate 100s linear infinite; */
	}

	/* @keyframes animate {
		0% {
			background: black;
		}
		50% {
			background: #222222;
		}
		100% {
			background: black;
		}
	} */

	ul a {
		text-decoration: none;
		color: #000000;
		font-weight: 400;
		/* padding: 0.25rem 0.5rem; */
		transition: 100ms all;
		font-size: 17px;
		justify-content: center;
		align-items: center;
		opacity: 0.7;
	}

	ul li {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0 0.25rem;
		background: #ffff66;
		border-radius: 8px;
		height: 2rem;
	}

	ul li:hover {
		background: #f0f066;
	}

	.actions {
		margin-left: auto;
	}
	.actions button {
		color: white;
	}
</style>

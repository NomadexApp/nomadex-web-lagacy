<script lang="ts">
	import { onNumberKeyPress } from '$lib/inputs';

	export let pretext = '';
	export let posttext = '';
	export let value = 0;
	export let token: string;
	export let showMax = false;
	export let disabled = false;
	export let handleMax = () => {};
</script>

<div class="field input-field relative">
	{#if pretext}
		<div class="absolute left-4 text-sm text-gray-50 opacity-50"><span>{pretext}</span></div>
	{/if}
	<div class="flex">
		<input
			type="number"
			step="0.000001"
			bind:value
			{disabled}
			on:keypress={onNumberKeyPress}
			on:keyup
			class="no-arrows"
			placeholder="0"
		/>
		<div class="right">
			<slot name="currency">
				<button class="currency" on:click>
					{token}
					<svg
						width="12"
						height="7"
						viewBox="0 0 12 7"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						class="SwapCurrencyInputPanel__StyledDropDown-sc-3e2fecea-8 jJfXUM"
						><path d="M0.97168 1L6.20532 6L11.439 1" stroke="currentColor" /></svg
					>
				</button>
			</slot>
		</div>
	</div>
	{#if posttext}
		<div class="absolute bottom-2 left-4 text-sm text-gray-50 opacity-50"><span>{posttext}</span></div>
	{/if}
	{#if showMax}
		<div
			class="absolute bottom-2 right-4 text-sm text-gray-50 opacity-50 cursor-pointer"
			on:click={() => handleMax()}
			on:keydown
		>
			<span>MAX</span>
		</div>
	{/if}
</div>

<style>
	.field {
		background: #282811;
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 0.5rem 0;
		padding-right: 1rem;
		border-radius: 8px;
	}

	.field input {
		padding: 1rem;
		width: 100%;
		outline: none;
		background: transparent;
		font-size: 2rem;
	}

	.field .right {
		width: max-content;
		min-width: 5rem;
		display: flex;
		justify-content: end;
		align-items: center;
	}

	.field .right .currency {
		padding: 0.25rem 1rem;
		background: #ffff6622;
		border-radius: 3rem;
		cursor: pointer;
	}

	.field .right .currency:hover {
		background: #ffff6633;
	}

	.field .right .currency svg {
		color: white;
	}

	.currency {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
	}
</style>

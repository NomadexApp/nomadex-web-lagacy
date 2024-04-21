<script lang="ts">
	export let pretext = '';
	export let placeholder = '';
	export let value = '';
</script>

<div class="field input-field relative">
	{#if pretext}
		<div class="absolute left-4 text-sm text-gray-50 opacity-50"><span>{pretext}</span></div>
	{/if}
	<div class="flex">
		<input type="text" {placeholder} bind:value />
	</div>
</div>

<style>
	.field {
		background: #00000033;
		backdrop-filter: blur(5px);
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 0.5rem 0;
		padding-right: 1.5rem;
		border-radius: 8px;
	}

	.field input {
		padding: 0.25rem 0.5rem;
		width: 100%;
		outline: none;
		background: transparent;
		font-size: 1rem;
	}
</style>

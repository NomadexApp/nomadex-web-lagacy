<script lang="ts">
	export let disabled = false;
</script>

<div class="buttons">
	<button class="btn w-full action-btn" {disabled} on:click><slot /></button>
</div>

<style>
	.action-btn:disabled {
		background: #ffff6622;
		color: var(--primary-color);
	}

	.action-btn:not(:disabled) {
		background: var(--primary-color);
		color: black;
	}

	.action-btn:disabled:hover {
		background: #ffff6633;
		color: var(--primary-color);
	}
</style>

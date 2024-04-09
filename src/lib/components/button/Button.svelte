<script lang="ts">
	export let primary = false;
</script>

<button class:primary>
	<slot />
</button>

<style>
	button {
		color: white;
		background-color: var(--secondary-color);
		padding: 0.75rem;
		border: none;
		border-radius: 0.4rem;
	}

	button.primary {
		background: var(--primary-color);
		color: var(--secondary-color);
	}
</style>

<script lang="ts">
	export let disabled = false;
</script>

<div class="buttons">
	<button class="btn w-full action-btn {disabled ? 'btn-ghost text-white' : 'btn-primary'}" class:disabled on:click>
		<slot />
	</button>
</div>

<style>
	.btn.disabled {
		pointer-events: none;
		background: #00000025;
	}
</style>

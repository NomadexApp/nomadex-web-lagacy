<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let items: {
		id: string;
		name: string;
		href: string;
		'data-sveltekit-noscroll'?: true;
	}[];
	export let active: string;

	const dispatch = createEventDispatcher();
</script>

<div class="sm:grid sm:grid-cols-2 gap-1">
	{#each items as item}
		{@const { id, name, href, ...rest } = item}
		<a
			{href}
			{...rest}
			class="btn hover:outline-none btn-outline text-[#ffffdd]"
			class:active={id === active}
			on:click={() => dispatch('select', item)}
		>
			{name}
		</a>
	{/each}
</div>

<style>
	a:not(.active) {
		border: 0px solid var(--color-primary);
		background: #00000033;
		backdrop-filter: blur(5px);
	}
	a.active,
	a:hover {
		border: 0px solid var(--color-primary);
	}
	a.active {
		background: var(--color-primary);
		color: black;
	}
</style>

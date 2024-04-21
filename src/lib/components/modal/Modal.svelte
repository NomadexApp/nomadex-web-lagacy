<script context="module" lang="ts">
	import { writable } from 'svelte/store';

	export const component = writable<ConstructorOfATypedSvelteComponent | undefined>();
	export const props = writable<Record<string, any> | undefined>();

	export function openModal(comp: ConstructorOfATypedSvelteComponent, props_: Record<string, any>) {
		props.set(props_);
		component.set(comp);
	}
</script>

<script lang="ts">
	export let open = true;

	function close() {
		open = false;
		component.set(undefined);
		props.set(undefined);
	}
</script>

<dialog {open}>
	<slot {close} />
</dialog>
<div on:keydown class="overlay" on:click={close} />

<style>
	dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		margin: 0;
		transform: translate(-50%, -50%);
		background: #222222;
		color: white;
		border-radius: 8px;
		width: max-content;
		height: min-content;
		max-height: calc(100vh - 2rem);
		max-width: calc(100vw - 2rem);
		overflow-x: auto;
		overflow-y: auto;
		padding: 1rem;
		box-shadow: #ffffff10 0px 0px 50px;
		min-height: 100px;
		z-index: 1001;
	}
	dialog[open] + .overlay {
		content: '';
		width: 100%;
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: #ffffff25;
		backdrop-filter: blur(2px);
		z-index: 1000;
	}
</style>

<script>
	import { goto } from '$app/navigation';
	import { getLastActivePair } from '$lib/config';
	import { lastActiveSwapPair } from '$lib/stores';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(`/swap/${getLastActivePair('swap', $lastActiveSwapPair)}`);
	});
</script>

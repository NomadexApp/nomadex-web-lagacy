<script lang="ts">
	import { goto } from '$app/navigation';
	import { connectedAccount } from '$lib/UseWallet.svelte';

	$: if (!$connectedAccount) {
		goto('/pool');
	}
</script>

<script lang="ts">
	export let data: [string, string][];
</script>

<div class="info text-[#fff9] text-sm flex flex-col">
	{#each data as info}
		<div class="">
			<div class="">{info[0]}</div>
			<div class="text-right">{info[1]}</div>
		</div>
	{/each}
</div>

<style>
	.info {
		padding: 0 4px;
	}
	.info > div {
		display: flex;
		justify-content: space-between;
	}
</style>

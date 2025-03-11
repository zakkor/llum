<script>
	import { createEventDispatcher } from 'svelte';
	import { feX, feFileText } from '$src/feather';
	import Icon from '$src/Icon.svelte';

	const dispatch = createEventDispatcher();

	export let file;
	export let canDelete = false;
</script>

<div class="flex mb-2 items-center self-start gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
	{#if canDelete}
		<button
			on:click={() => {
				dispatch('delete');
			}}
			class="flex h-4 w-4 rounded-full"
		>
			<Icon icon={feX} class="m-auto h-3.5 w-3.5 text-slate-600" />
		</button>
	{:else}
		<!-- If can not delete, then the action is to show file contents.	-->
		<button
			on:click={() => {
				dispatch('showContents');
			}}
			class="flex h-4 w-4 rounded-full"
		>
			<Icon icon={feFileText} class="m-auto h-3.5 w-3.5 text-slate-600" />
		</button>
	{/if}
	<span class="text-sm text-black">{file.path.replace(/^.*[\/\\]/, '')}</span>
</div>

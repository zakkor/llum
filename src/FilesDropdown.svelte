<script>
	import { scale } from 'svelte/transition';
	import { cubicIn } from 'svelte/easing';
	import FileTreeNode from './FileTreeNode.svelte';

	export let open = false;
	export let tree;
	export let selectedFiles = [];

	// For keeping track of collapsed state of directories
	let collapsed = {};


	// Clear all selections
	function clearSelections() {
		selectedFiles = [];
	}
</script>

<svelte:window
	on:click={(event) => {
		if (!event.target.closest('#files-dropdown')) {
			open = false;
		}
	}}
	on:touchstart={(event) => {
		if (!event.target.closest('#files-dropdown')) {
			open = false;
		}
	}}
/>

{#if open && tree}
	<div
		id="files-dropdown"
		class="absolute bottom-10 left-0 z-10 flex w-[max-content] rounded-[10px]"
	>
		<div
			transition:scale={{ opacity: 0, start: 0.98, duration: 100, easing: cubicIn }}
			class="flex h-auto w-auto min-w-[250px] flex-col self-start overflow-y-auto rounded-lg border border-slate-300 bg-white"
		>
			<div class="w-full px-3 pb-2 pt-2.5">
				<div class="mb-1 flex items-center justify-between">
					<h3 class="text-sm font-medium text-slate-800">Files</h3>
					<button class="text-xs text-gray-600 hover:text-gray-800" on:click={clearSelections}>
						Unselect all
					</button>
				</div>
			</div>
			<ul class="max-h-[300px] overflow-y-auto pb-1.5 scrollbar-ultraslim">
				<FileTreeNode
					item={tree}
					level={0}
					{collapsed}
					bind:selectedFiles
					on:fileSelected
					on:fileDeselected
				/>
			</ul>
		</div>
	</div>
{/if}

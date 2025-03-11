<script lang="ts">
	import { flash } from '../../../../actions.js';
	import { feChevronDown, feChevronUp, feCopy, feFile } from '../../../../feather.js';
	import Icon from '../../../../Icon.svelte';
	import type { MarkdownOptions, Renderers } from '../../markedConfiguration';
	import type { Tokens } from 'marked';
	import { afterUpdate } from 'svelte';
	import FilePill from '$src/FilePill.svelte';

	export let token: Tokens.Code;
	export const options: MarkdownOptions = undefined;
	export const renderers: Renderers = undefined;
	export let message;

	let showContents = message && message.role === 'assistant';
	let attrs: Record<string, any> = {};

	function parseAttributes(langString) {
		const regex = /(\w+)=["'](.+?)["']/g;
		const attrs = {};
		let match;
		while ((match = regex.exec(langString)) !== null) {
			attrs[match[1]] = match[2];
		}
		return attrs;
	}

	$: if (token.lang) {
		attrs = parseAttributes(token.lang);
	}

	let clientHeight;
	let scrollableEl, fadeEl;
	let showingAll = false;

	function updateFade() {
		if (!scrollableEl || !fadeEl) {
			return;
		}
		const isScrolledToEnd =
			scrollableEl.scrollTop + scrollableEl.clientHeight >= scrollableEl.scrollHeight;
		if (isScrolledToEnd) {
			fadeEl.style.background = 'transparent';
		} else {
			fadeEl.style.removeProperty('background');
		}
	}

	afterUpdate(() => {
		updateFade();
	});
</script>

{#if attrs.filepath && !showContents}
	<FilePill
		file={{ path: attrs.filepath }}
		canDelete={false}
		on:showContents={() => (showContents = true)}
	/>
{:else}
	<div class="relative" bind:clientHeight>
		<div
			bind:this={fadeEl}
			class="pointer-events-none absolute left-0 right-0 top-4 z-10 flex h-16 w-full"
		>
			<button
				class="code-copy-button pointer-events-auto z-10 my-auto ml-auto mr-4 flex items-center gap-x-1.5 self-start rounded-full bg-gray-200 px-3.5 py-2 text-left text-xs transition-colors hover:bg-gray-300"
				use:flash
				on:click={(event) => {
					event.currentTarget.dispatchEvent(new CustomEvent('flashSuccess'));
					navigator.clipboard.writeText(token.text);
				}}
			>
				<Icon icon={feCopy} class="h-3 w-3" />
				Copy
			</button>
		</div>
		{#if clientHeight > 400}
			<div
				bind:this={fadeEl}
				class="pointer-events-none absolute bottom-4 left-0 right-0 z-10 flex h-16 w-full {!showingAll
					? 'rounded-b-lg border-b border-l border-r border-slate-200 bg-gradient-to-b from-transparent to-slate-50'
					: ''}"
			>
				<button
					class="pointer-events-auto m-auto flex items-center gap-x-1.5 self-start rounded-full bg-gray-200 px-3.5 py-2 text-left text-xs transition-colors hover:bg-gray-300"
					on:click={() => (showingAll = !showingAll)}
				>
					<Icon
						icon={showingAll ? feChevronUp : feChevronDown}
						class="h-4 w-4 transition-transform"
					/>
					{showingAll ? 'Show less' : 'Show all'}
				</button>
			</div>
		{/if}
		<pre
			bind:this={scrollableEl}
			on:scroll={updateFade}
			class={clientHeight > 400 && !showingAll
				? 'max-h-[400px] overflow-y-auto scrollbar-ultraslim'
				: ''}><code class={`lang-${token.lang}`}>{token.text}</code></pre>
	</div>
{/if}

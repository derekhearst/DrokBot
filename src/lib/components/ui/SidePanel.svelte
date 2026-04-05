<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		children,
		class: className = '',
	}: {
		open?: boolean;
		children?: Snippet;
		class?: string;
	} = $props();

	function handleOverlayClick() {
		open = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Desktop: inline sidebar column -->
<aside class="hidden overflow-y-auto rounded-3xl border border-base-300 bg-base-100/80 p-4 shadow-sm lg:block {className}">
	{#if children}{@render children()}{/if}
</aside>

<!-- Mobile/tablet: slide-out panel from right -->
{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
		onclick={handleOverlayClick}
		onkeydown={handleKeydown}
	></div>
{/if}
<aside
	class="fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col border-l border-base-300 bg-base-100 p-4 shadow-lg transition-transform duration-200 ease-out lg:hidden {open ? 'translate-x-0' : 'translate-x-full'} {className}"
>
	<button
		class="btn btn-ghost btn-sm btn-circle self-end mb-2"
		type="button"
		onclick={() => (open = false)}
		aria-label="Close panel"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
	</button>
	<div class="flex-1 overflow-y-auto">
		{#if children}{@render children()}{/if}
	</div>
</aside>

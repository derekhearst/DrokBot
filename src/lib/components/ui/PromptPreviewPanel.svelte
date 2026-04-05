<script lang="ts">
	import { onMount } from 'svelte';
	import { getFullPromptPreview } from '$lib/settings';

	type PromptPreview = Awaited<ReturnType<typeof getFullPromptPreview>>;

	let preview = $state<PromptPreview | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(() => {
		void load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			preview = await getFullPromptPreview();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load prompt preview';
		} finally {
			loading = false;
		}
	}

	function formatTokens(n: number): string {
		if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
		return String(n);
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between px-1 pb-3">
		<h2 class="text-sm font-bold tracking-tight">Context Explorer</h2>
		<button class="btn btn-ghost btn-xs btn-circle" type="button" onclick={load} disabled={loading} aria-label="Refresh">
			{#if loading}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 2v6h-6"></path>
					<path d="M3 11a9 9 0 0 1 15-6.7L21 8"></path>
					<path d="M3 22v-6h6"></path>
					<path d="M21 13a9 9 0 0 1-15 6.7L3 16"></path>
				</svg>
			{/if}
		</button>
	</div>

	{#if error}
		<p class="rounded-lg bg-error/10 p-2 text-xs text-error">{error}</p>
	{:else if loading && !preview}
		<div class="flex flex-1 items-center justify-center">
			<span class="loading loading-spinner loading-md text-base-content/30"></span>
		</div>
	{:else if preview}
		<div class="flex-1 space-y-3 overflow-y-auto">
			<!-- Meta -->
			<div class="flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-base-200/50 px-2.5 py-2 text-[10px] text-base-content/50">
				<span>Model: <span class="font-mono text-base-content/70">{preview.model}</span></span>
				<span>Approval: <span class="font-mono text-base-content/70">{preview.toolApprovalMode}</span></span>
			</div>

			<!-- Scenario comparison -->
			<div class="rounded-lg bg-base-200/50 px-2.5 py-2">
				<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-base-content/40">Context by scenario</p>
				<div class="grid grid-cols-2 gap-2 text-[10px]">
					<div class="rounded-md bg-success/10 px-2 py-1.5">
						<p class="font-semibold text-success">Simple query</p>
						<p class="font-mono text-base-content/60">~{formatTokens(preview.scenarios.minimal.tokens)} tokens</p>
						<p class="text-base-content/40">{preview.scenarios.minimal.toolCount} tools</p>
					</div>
					<div class="rounded-md bg-warning/10 px-2 py-1.5">
						<p class="font-semibold text-warning">Full capability</p>
						<p class="font-mono text-base-content/60">~{formatTokens(preview.scenarios.full.tokens)} tokens</p>
						<p class="text-base-content/40">{preview.scenarios.full.toolCount} tools</p>
					</div>
				</div>
			</div>

			<!-- Capability Groups -->
			<div>
				<p class="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
					<span class="inline-block h-1 w-1 rounded-full bg-primary"></span>
					Capability Groups
				</p>
				<div class="space-y-1">
					{#each preview.capabilityGroups as group}
						<div class="flex items-center justify-between rounded-md bg-base-200/50 px-2 py-1">
							<div class="flex items-center gap-1.5">
								{#if group.alwaysOn}
									<span class="badge badge-xs badge-success">on</span>
								{:else}
									<span class="badge badge-xs badge-ghost">auto</span>
								{/if}
								<span class="text-[10px] font-medium text-base-content/70">{group.label}</span>
							</div>
							<span class="text-[9px] font-mono text-base-content/40">{group.toolCount} tools</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- System Messages -->
			{#each preview.systemMessages as msg}
				<div>
					<p class="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
						<span class="inline-block h-1 w-1 rounded-full bg-secondary"></span>
						{msg.label}
						<span class="ml-auto font-mono text-[9px] font-normal text-base-content/30">~{formatTokens(msg.tokens)} tok</span>
					</p>
					<pre class="whitespace-pre-wrap rounded-lg bg-base-200/50 p-2 font-mono text-[10px] leading-relaxed text-base-content/70">{msg.content}</pre>
				</div>
			{/each}

			<!-- Tool Definitions -->
			<div>
				<p class="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
					<span class="inline-block h-1 w-1 rounded-full bg-accent"></span>
					Tools ({preview.tools.length})
				</p>
				<details class="group">
					<summary class="cursor-pointer rounded-lg bg-base-200/50 px-2.5 py-1.5 text-[10px] font-medium text-base-content/50 select-none hover:bg-base-200/70">
						Expand tool schemas
						<svg class="ml-0.5 inline-block h-2.5 w-2.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7" /></svg>
					</summary>
					<pre class="mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-base-200/50 p-2 font-mono text-[9px] leading-relaxed text-base-content/60">{JSON.stringify(preview.tools, null, 2)}</pre>
				</details>
			</div>
		</div>
	{/if}
</div>

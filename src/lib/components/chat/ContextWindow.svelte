<script lang="ts">
	let {
		used = 0,
		total = 128000,
		reserved = 0,
		breakdown,
		onCompact
	} = $props<{
		used?: number;
		total?: number;
		reserved?: number;
		breakdown?: { system: number; memories: number; tools: number; messages: number; results: number };
		onCompact?: (() => Promise<void> | void) | undefined;
	}>();

	const pct = $derived(total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0);
	const summary = $derived(`${(used / 1000).toFixed(1)}K / ${(total / 1000).toFixed(0)}K tokens`);
	const rows = $derived([
		['System prompt', breakdown?.system ?? 0],
		['Memories', breakdown?.memories ?? 0],
		['Tool definitions', breakdown?.tools ?? 0],
		['Chat messages', breakdown?.messages ?? 0],
		['Tool results', breakdown?.results ?? 0]
	]);
</script>

<details class="rounded-2xl border border-base-300 bg-base-100/80 p-3">
	<summary class="cursor-pointer text-sm font-medium">Context Window - {summary} ({pct}%)</summary>
	<div class="mt-3 space-y-3">
		<div class="h-3 overflow-hidden rounded-full bg-base-300">
			<div class="h-full bg-primary" style={`width:${pct}%`}></div>
		</div>
		{#if reserved > 0}
			<p class="text-xs opacity-70">Reserved for response: {reserved.toLocaleString()} tokens</p>
		{/if}
		<div class="grid gap-1 text-xs">
			{#each rows as row (row[0])}
				<div class="flex items-center justify-between">
					<span>{row[0]}</span>
					<span>{row[1]}%</span>
				</div>
			{/each}
		</div>
		<button class="btn btn-xs btn-outline" type="button" onclick={() => onCompact?.()}>Compact Context</button>
	</div>
</details>

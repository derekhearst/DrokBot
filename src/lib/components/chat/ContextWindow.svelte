<script lang="ts">
	let {
		used = 0,
		total = 128000,
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
	const usedK = $derived((used / 1000).toFixed(1));
	const totalK = $derived((total / 1000).toFixed(0));

	const stats = $derived([
		{ icon: '⚡', label: 'System', value: breakdown?.system ?? 0, bar: 'bg-info' },
		{ icon: '🧠', label: 'Memories', value: breakdown?.memories ?? 0, bar: 'bg-success' },
		{ icon: '🔧', label: 'Tools', value: breakdown?.tools ?? 0, bar: 'bg-warning' },
		{ icon: '💬', label: 'Messages', value: breakdown?.messages ?? 0, bar: 'bg-primary' },
		{ icon: '📊', label: 'Results', value: breakdown?.results ?? 0, bar: 'bg-secondary' }
	]);
</script>

<div class="flex items-center gap-3 text-xs text-base-content/50">
	<!-- Segmented bar: overall fill, then sub-segments inside -->
	<div
		class="relative h-1.5 w-24 overflow-hidden rounded-full bg-base-300"
		title={`${usedK}K / ${totalK}K tokens (${pct}%)`}
	>
		<div class="absolute inset-y-0 left-0 flex" style={`width:${pct}%`}>
			{#each stats as stat (stat.label)}
				{#if stat.value > 0}
					<div
						class="{stat.bar} h-full"
						style={`width:${stat.value}%`}
						title={`${stat.label}: ${stat.value}%`}
					></div>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Stat chips -->
	{#each stats as stat (stat.label)}
		<span class="tooltip tooltip-bottom" data-tip="{stat.label}: {stat.value}%">
			<span class="flex cursor-default items-center gap-0.5">
				<span class="text-[0.7rem] leading-none">{stat.icon}</span>
				<span class="tabular-nums">{stat.value}%</span>
			</span>
		</span>
	{/each}

	<!-- Token count -->
	<span class="ml-1 font-mono opacity-60">{usedK}K<span class="opacity-50">/{totalK}K</span></span>

	{#if onCompact}
		<button
			class="btn btn-xs btn-ghost h-5 min-h-0 px-1.5 opacity-40 hover:opacity-100"
			type="button"
			onclick={() => onCompact?.()}
		>
			compact
		</button>
	{/if}
</div>

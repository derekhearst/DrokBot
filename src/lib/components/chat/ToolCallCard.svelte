<script lang="ts">
	let {
		name,
		argumentsText = '',
		result = '',
		executionMs = null
	} = $props<{ name: string; argumentsText?: string; result?: string; executionMs?: number | null }>();

	const colorClass = $derived(
		name === 'web_search'
			? 'border-info/50 bg-info/10'
			: name.includes('code')
				? 'border-success/50 bg-success/10'
				: name.includes('file')
					? 'border-warning/50 bg-warning/10'
					: 'border-accent/50 bg-accent/10'
	);
</script>

<details class={`rounded-xl border ${colorClass}`}>
	<summary class="cursor-pointer px-3 py-2 text-sm font-medium">
		{name}
		{#if executionMs !== null}
			<span class="ml-2 text-xs opacity-70">{executionMs}ms</span>
		{/if}
	</summary>
	<div class="space-y-2 px-3 pb-3">
		{#if argumentsText}
			<pre class="overflow-x-auto rounded-lg bg-base-100 p-2 text-xs">{argumentsText}</pre>
		{/if}
		{#if result}
			<pre class="overflow-x-auto rounded-lg bg-base-100 p-2 text-xs">{result}</pre>
		{/if}
	</div>
</details>

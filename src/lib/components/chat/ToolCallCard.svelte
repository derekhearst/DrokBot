<script lang="ts">
	let {
		name,
		argumentsText = '',
		result = '',
		executionMs = null
	} = $props<{ name: string; argumentsText?: string; result?: string; executionMs?: number | null }>();

	const isScreenshot = $derived(name === 'browser_screenshot');

	const colorClass = $derived(
		name === 'web_search'
			? 'border-info/50 bg-info/10'
			: name.includes('code')
				? 'border-success/50 bg-success/10'
				: name.includes('file')
					? 'border-warning/50 bg-warning/10'
					: 'border-accent/50 bg-accent/10'
	);

	const screenshotSrc = $derived.by(() => {
		if (!isScreenshot || !result) return '';
		try {
			const parsed = JSON.parse(result);
			if (parsed.imageBase64) return `data:image/png;base64,${parsed.imageBase64}`;
		} catch {}
		if (result.startsWith('data:image')) return result;
		return '';
	});
</script>

<details class={`rounded-xl border ${colorClass} transition-all duration-300`}>
	<summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium select-none">
		<svg class="h-4 w-4 shrink-0 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10" />
			<polyline points="16 10 11 15.5 8 12.5" />
		</svg>
		<span class="truncate">{name}</span>
		{#if executionMs !== null}
			<span class="ml-auto text-xs opacity-50">{executionMs}ms</span>
		{/if}
	</summary>
	<div class="space-y-2 px-3 pb-3">
		{#if argumentsText}
			<pre class="overflow-x-auto rounded-lg bg-base-100 p-2 text-xs">{argumentsText}</pre>
		{/if}
		{#if result}
			{#if screenshotSrc}
				<img src={screenshotSrc} alt="Browser screenshot" class="max-w-full rounded-lg border border-base-300" />
			{:else}
				<pre class="max-h-48 overflow-auto rounded-lg bg-base-100 p-2 text-xs">{result}</pre>
			{/if}
		{/if}
	</div>
</details>

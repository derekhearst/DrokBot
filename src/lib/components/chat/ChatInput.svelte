<script lang="ts">
	let {
		busy = false,
		model = 'anthropic/claude-sonnet-4',
		onSubmit,
		onModelChange,
		estimatedRemaining = 128000
	} = $props<{
		busy?: boolean;
		model?: string;
		onSubmit?: ((content: string) => Promise<void> | void) | undefined;
		onModelChange?: ((model: string) => Promise<void> | void) | undefined;
		estimatedRemaining?: number;
	}>();

	const models = [
		'anthropic/claude-sonnet-4',
		'anthropic/claude-opus-4',
		'openai/gpt-4o-mini'
	];

	let value = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = value.trim();
		if (!trimmed || busy) return;
		await onSubmit?.(trimmed);
		value = '';
	}
</script>

<form class="space-y-2" onsubmit={submit}>
	<div class="flex flex-wrap items-center gap-2 text-xs opacity-70">
		<span>Model</span>
		<select
			class="select select-xs select-bordered"
			value={model}
			onchange={(event) => onModelChange?.((event.currentTarget as HTMLSelectElement).value)}
		>
			{#each models as option (option)}
				<option value={option}>{option}</option>
			{/each}
		</select>
		<span>Estimated remaining: {estimatedRemaining.toLocaleString()} tokens</span>
	</div>

	<div class="flex items-end gap-2 rounded-2xl border border-base-300 bg-base-100 p-2">
		<textarea
			class="textarea w-full border-none bg-transparent focus:outline-none"
			rows="2"
			placeholder="Message DrokBot..."
			bind:value
			disabled={busy}
		></textarea>
		<button class="btn btn-primary" type="submit" disabled={busy || value.trim().length === 0}>
			{busy ? 'Streaming...' : 'Send'}
		</button>
	</div>
</form>

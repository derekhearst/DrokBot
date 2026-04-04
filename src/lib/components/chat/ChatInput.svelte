<script lang="ts">
	import ChatComposer from '$lib/components/chat/ChatComposer.svelte';

	let {
		busy = false,
		model = 'anthropic/claude-sonnet-4',
		onSubmit,
		onModelChange,
		onCancelGeneration,
		estimatedRemaining = 128000
	} = $props<{
		busy?: boolean;
		model?: string;
		onSubmit?: ((content: string) => Promise<void> | void) | undefined;
		onModelChange?: ((model: string) => Promise<void> | void) | undefined;
		onCancelGeneration?: (() => Promise<void> | void) | undefined;
		estimatedRemaining?: number;
	}>();

	let value = $state('');

	async function handleSubmit(content: string) {
		if (!content.trim() || busy) return;
		await onSubmit?.(content);
		value = '';
	}
</script>

<div class="space-y-2">
	<ChatComposer
		bind:value
		{busy}
		{model}
		placeholder="Message DrokBot..."
		onSubmit={(content) => handleSubmit(content)}
		onModelChange={(id) => onModelChange?.(id)}
		onCancelGeneration={() => onCancelGeneration?.()}
		onAddFiles={() => {
			// File picker hook will be wired in a later pass.
		}}
		onMicClick={() => {
			// Voice capture hook will be wired in a later pass.
		}}
	/>
</div>

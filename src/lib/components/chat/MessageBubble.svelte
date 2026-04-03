<script lang="ts">
	import ToolCallCard from './ToolCallCard.svelte';

	type MessageRow = {
		id: string;
		role: 'user' | 'assistant' | 'system' | 'tool';
		content: string;
		model: string | null;
		tokensIn: number;
		tokensOut: number;
		cost: string;
		ttftMs: number | null;
		totalMs: number | null;
		tokensPerSec: number | null;
		createdAt: Date | string;
		toolCalls?: Array<Record<string, unknown>>;
	};

	let {
		message,
		onEdit,
		onRegenerate
	} = $props<{
		message: MessageRow;
		onEdit?: ((messageId: string, content: string) => Promise<void> | void) | undefined;
		onRegenerate?: ((messageId: string) => Promise<void> | void) | undefined;
	}>();

	let editing = $state(false);
	let draft = $state('');
	let expanded = $state(false);

	const isUser = $derived(message.role === 'user');
	const isAssistant = $derived(message.role === 'assistant');

	async function submitEdit() {
		if (!draft.trim()) return;
		await onEdit?.(message.id, draft.trim());
		editing = false;
	}

	function startEditing() {
		draft = message.content;
		editing = true;
	}
</script>

<article class={`chat ${isUser ? 'chat-end' : 'chat-start'}`}>
	<div class="chat-header text-xs opacity-70">
		{message.role}
		<span class="ml-1">{new Date(message.createdAt).toLocaleTimeString()}</span>
	</div>

	<div class={`chat-bubble max-w-3xl ${isUser ? 'chat-bubble-primary' : 'chat-bubble-neutral'}`}>
		{#if editing}
			<textarea class="textarea textarea-bordered w-full" bind:value={draft}></textarea>
			<div class="mt-2 flex gap-2">
				<button class="btn btn-xs btn-primary" type="button" onclick={submitEdit}>Save</button>
				<button class="btn btn-xs" type="button" onclick={() => (editing = false)}>Cancel</button>
			</div>
		{:else}
			<p class="whitespace-pre-wrap">{message.content}</p>
		{/if}
	</div>

	{#if !editing}
		<div class="mt-1 flex items-center gap-2 text-xs">
			{#if isUser}
				<button class="btn btn-xs btn-ghost" type="button" onclick={startEditing}>Edit</button>
			{/if}
			{#if isAssistant}
				<button class="btn btn-xs btn-ghost" type="button" onclick={() => onRegenerate?.(message.id)}>
					Regenerate
				</button>
			{/if}
			<button class="btn btn-xs btn-ghost" type="button" onclick={() => (expanded = !expanded)}>
				{expanded ? 'Hide stats' : 'Show stats'}
			</button>
		</div>
	{/if}

	{#if expanded}
		<div class="mt-1 rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-xs">
			<div class="grid gap-1 sm:grid-cols-3">
				<span>Model: {message.model ?? 'n/a'}</span>
				<span>Tokens: {message.tokensIn}/{message.tokensOut}</span>
				<span>Cost: ${message.cost}</span>
				<span>TTFT: {message.ttftMs ?? '-'}ms</span>
				<span>Total: {message.totalMs ?? '-'}ms</span>
				<span>Tok/s: {message.tokensPerSec ?? '-'}</span>
			</div>
		</div>
	{/if}

	{#if message.toolCalls && message.toolCalls.length > 0}
		<div class="mt-2 space-y-2">
			{#each message.toolCalls as call, idx (`${message.id}-${idx}`)}
				<ToolCallCard
					name={String(call.name ?? 'tool')}
					argumentsText={JSON.stringify(call.arguments ?? {}, null, 2)}
					result={typeof call.result === 'string' ? call.result : JSON.stringify(call.result ?? {}, null, 2)}
				/>
			{/each}
		</div>
	{/if}
</article>

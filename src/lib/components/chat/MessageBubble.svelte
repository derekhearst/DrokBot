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

	const isUser = $derived(message.role === 'user');
	const isAssistant = $derived(message.role === 'assistant');
	const estimatedTokensOut = $derived(
		message.tokensOut > 0 ? message.tokensOut : Math.max(1, Math.ceil((message.content?.length ?? 0) / 4))
	);
	const estimatedTokensIn = $derived(
		message.tokensIn > 0 ? message.tokensIn : Math.max(1, Math.ceil((message.content?.length ?? 0) / 4))
	);
	const formattedCost = $derived(Number.parseFloat(message.cost || '0').toFixed(4));

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

<article class={`chat w-full ${isUser ? 'chat-end' : 'chat-start'}`}>
	<div class={`chat-bubble ${isUser ? 'chat-bubble-primary max-w-[90%]' : 'chat-bubble-neutral max-w-full w-full'}`}>
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
		<div class={`mt-1 flex w-full items-center gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
			{#if isUser}
				<button class="btn btn-ghost btn-xs btn-circle" type="button" onclick={startEditing} title="Edit message" aria-label="Edit message">
					<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 20h9"></path>
						<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
					</svg>
				</button>
			{/if}
			{#if isAssistant}
				<button class="btn btn-ghost btn-xs btn-circle" type="button" onclick={() => onRegenerate?.(message.id)} title="Regenerate response" aria-label="Regenerate response">
					<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M23 4v6h-6"></path>
						<path d="M20.5 15a9 9 0 1 1 2.1-9"></path>
					</svg>
				</button>
			{/if}
			<div class="dropdown dropdown-top">
				<button class="btn btn-ghost btn-xs btn-circle" type="button" title="Message stats" aria-label="Message stats">
					<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="10"></circle>
						<path d="M12 16v-4"></path>
						<path d="M12 8h.01"></path>
					</svg>
				</button>
				<div class="dropdown-content z-20 mt-2 w-72 rounded-xl border border-base-300 bg-base-100 p-3 text-xs shadow-xl">
					<div class="grid grid-cols-2 gap-x-3 gap-y-2">
						<span class="opacity-70">Model</span>
						<span class="truncate text-right">{message.model ?? 'n/a'}</span>
						<span class="opacity-70">Tokens In</span>
						<span class="text-right">{estimatedTokensIn}</span>
						<span class="opacity-70">Tokens Out</span>
						<span class="text-right">{estimatedTokensOut}</span>
						<span class="opacity-70">Cost</span>
						<span class="text-right">${formattedCost}</span>
						<span class="opacity-70">TTFT</span>
						<span class="text-right">{message.ttftMs ?? 'n/a'}{message.ttftMs !== null ? 'ms' : ''}</span>
						<span class="opacity-70">Total</span>
						<span class="text-right">{message.totalMs ?? 'n/a'}{message.totalMs !== null ? 'ms' : ''}</span>
						<span class="opacity-70">Tok/s</span>
						<span class="text-right">{message.tokensPerSec ?? 'n/a'}</span>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if message.toolCalls && message.toolCalls.length > 0}
		<div class="mt-2 w-full space-y-2">
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

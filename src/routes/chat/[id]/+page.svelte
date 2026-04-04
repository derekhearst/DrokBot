<svelte:head><title>{conversationData?.conversation.title ?? 'Chat'} | DrokBot</title></svelte:head>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import {
		editMessage,
		getConversation,
		getMessageStats
	} from '$lib/chat';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import ContextWindow from '$lib/components/chat/ContextWindow.svelte';
	import MessageBubble from '$lib/components/chat/MessageBubble.svelte';

	const conversationId = $derived(page.params.id ?? '');
	let model = $state('anthropic/claude-sonnet-4');
	let streaming = $state(false);
	let streamError = $state<string | null>(null);
	let draftAssistant = $state('');
	let pendingMessageId = $state<string | null>(null);
	let pendingUserMessages = $state<Array<{ id: string; content: string; createdAt: Date }>>([]);
	let pendingAssistantDrafts = $state<Array<{ id: string; content: string; createdAt: Date }>>([]);
	let waitingForFirstToken = $state(false);
	let streamAbortController = $state<AbortController | null>(null);
	let stoppedByUser = $state(false);
	let conversationData = $state<Awaited<ReturnType<typeof getConversation>> | null>(null);
	let stats = $state<Awaited<ReturnType<typeof getMessageStats>>>([]);
	let messagesEl = $state<HTMLDivElement | undefined>(undefined);
	let consumedInitialPrompt = $state(false);

	async function scrollToBottom() {
		await tick();
		if (messagesEl) {
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}
	}

	$effect(() => {
		// Auto-scroll when messages change or during streaming
		void messages.length;
		void draftAssistant;
		scrollToBottom();
	});

	$effect(() => {
		void loadConversationState();
	});

	const messages = $derived(conversationData?.messages ?? []);
	const initialPrompt = $derived(page.url.searchParams.get('prompt')?.trim() ?? '');
	const displayedMessages = $derived.by(() => {
		const remoteMessages = messages;
		const remoteIds = new Set(remoteMessages.map((message) => message.id));

		const optimisticUsers = pendingUserMessages
			.filter((message) =>
				!remoteMessages.some(
					(remote) =>
						remote.role === 'user' &&
						remote.content === message.content &&
						new Date(remote.createdAt).getTime() >= message.createdAt.getTime() - 15000
				)
			)
			.map((message) => ({
				id: message.id,
				role: 'user' as const,
				content: message.content,
				model,
				tokensIn: 0,
				tokensOut: 0,
				cost: '0',
				ttftMs: null,
				totalMs: null,
				tokensPerSec: null,
				createdAt: message.createdAt,
				toolCalls: []
			}));

		const pendingAssistants = pendingAssistantDrafts
			.filter((message) => !remoteIds.has(message.id))
			.map((message) => ({
				id: message.id,
				role: 'assistant' as const,
				content: message.content,
				model,
				tokensIn: 0,
				tokensOut: 0,
				cost: '0',
				ttftMs: null,
				totalMs: null,
				tokensPerSec: null,
				createdAt: message.createdAt,
				toolCalls: []
			}));

		const combined = [...remoteMessages, ...optimisticUsers, ...pendingAssistants];
		combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
		return combined;
	});

	const usedTokens = $derived(stats.reduce((sum, row) => sum + row.tokensIn + row.tokensOut, 0));

	$effect(() => {
		if (conversationData?.conversation.model) {
			model = conversationData.conversation.model;
		}
	});

	$effect(() => {
		const prompt = initialPrompt;
		if (!prompt || consumedInitialPrompt || !conversationId || streaming) return;
		if (messages.length > 0 || pendingUserMessages.length > 0) {
			consumedInitialPrompt = true;
			return;
		}

		consumedInitialPrompt = true;
		void streamMessage(prompt, false).finally(() => {
			void goto(`/chat/${conversationId}`, {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		});
	});

	$effect(() => {
		void displayedMessages.length;
		if (!pendingMessageId) return;
		if (messages.some((message) => message.id === pendingMessageId)) {
			draftAssistant = '';
			pendingMessageId = null;
		}
	});

	function reconcilePendingWithRemote(remoteMessages: typeof messages) {
		pendingAssistantDrafts = pendingAssistantDrafts.filter((draft) =>
			!remoteMessages.some((message) => message.id === draft.id)
		);
		pendingUserMessages = pendingUserMessages.filter(
			(pending) =>
				!remoteMessages.some(
					(remote) =>
						remote.role === 'user' &&
						remote.content === pending.content &&
						new Date(remote.createdAt).getTime() >= pending.createdAt.getTime() - 15000
				)
		);
	}

	async function loadConversationState() {
		if (!conversationId) {
			conversationData = null;
			stats = [];
			return;
		}

		const [conversationResult, statsResult] = await Promise.all([
			getConversation(conversationId),
			getMessageStats(conversationId)
		]);
		conversationData = conversationResult;
		stats = statsResult;
		reconcilePendingWithRemote(conversationResult?.messages ?? []);
	}

	async function refreshAll() {
		await loadConversationState();
	}

	function stopStreaming() {
		if (!streaming || !streamAbortController) return;
		stoppedByUser = true;
		streamAbortController.abort();
	}

	async function streamMessage(content: string, regenerate = false) {
		if (!conversationId || streaming) return;

		const abortController = new AbortController();
		const startedAt = new Date();
		const optimisticUserId = `pending-user-${startedAt.getTime()}`;
		if (!regenerate) {
			pendingUserMessages = [
				...pendingUserMessages,
				{ id: optimisticUserId, content: content.trim(), createdAt: startedAt }
			];
		}

		streaming = true;
		streamError = null;
		draftAssistant = '';
		pendingMessageId = null;
		waitingForFirstToken = true;
		streamAbortController = abortController;
		stoppedByUser = false;
		try {
			const response = await fetch(`/chat/${conversationId}/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ conversationId, content, model, regenerate }),
				signal: abortController.signal
			});

			if (!response.ok || !response.body) {
				throw new Error('Failed to open stream');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const events = buffer.split('\n\n');
				buffer = events.pop() ?? '';

				for (const raw of events) {
					const lines = raw.split('\n');
					const eventLine = lines.find((line) => line.startsWith('event: '));
					const dataLine = lines.find((line) => line.startsWith('data: '));
					if (!eventLine || !dataLine) continue;

					const eventName = eventLine.slice(7).trim();
					const payload = JSON.parse(dataLine.slice(6));

					if (eventName === 'delta') {
						waitingForFirstToken = false;
						draftAssistant += payload.content ?? '';
					}

					if (eventName === 'done') {
						waitingForFirstToken = false;
						if (payload.error) {
							streamError = payload.error;
						} else if (payload.messageId) {
							// Keep draft visible until refreshAll() completes
							pendingMessageId = payload.messageId;
							if (draftAssistant.trim()) {
								pendingAssistantDrafts = [
									...pendingAssistantDrafts.filter((draft) => draft.id !== payload.messageId),
									{ id: payload.messageId, content: draftAssistant, createdAt: new Date() }
								];
							}
						}
					}
				}
			}

			// Successful stream end — don't call refreshAll here; finally handles it
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				if (!stoppedByUser) {
					streamError = 'Stream interrupted';
				}
			} else {
				streamError = error instanceof Error ? error.message : 'Streaming error';
			}
		} finally {
			// Always reload messages so user & assistant messages show even after an error
			await refreshAll().catch(() => {});
			if (pendingMessageId && messages.some((message) => message.id === pendingMessageId)) {
				draftAssistant = '';
				pendingMessageId = null;
			}
			streaming = false;
			waitingForFirstToken = false;
			streamAbortController = null;
			stoppedByUser = false;
		}
	}

	async function handleEdit(messageId: string, content: string) {
		await editMessage({ messageId, content });
		await refreshAll();
	}

	async function handleRegenerate() {
		await streamMessage('regenerate', true);
	}

	async function compactContext() {
		console.log('Compact context requested for', conversationId);
	}
</script>

{#if !conversationData}
	<p class="text-sm opacity-70">Conversation not found.</p>
{:else}
	<section class="flex min-h-0 w-full flex-1 flex-col gap-3 py-4">
		<!-- Inline floating top bar: title · model · context stats -->
		<div class="flex shrink-0 items-center gap-3 px-1">
			<h1 class="min-w-0 flex-1 truncate text-base font-semibold">
				{conversationData.conversation.title}
			</h1>
			<span class="badge badge-ghost shrink-0 text-xs opacity-60">
				{model.split('/').at(-1) ?? model}
			</span>
			<ContextWindow
				used={usedTokens}
				total={128000}
				breakdown={{ system: 10, memories: 12, tools: 8, messages: 55, results: 15 }}
				onCompact={compactContext}
			/>
		</div>

		<div bind:this={messagesEl} class="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-4">
			{#each displayedMessages as message (message.id)}
				<MessageBubble message={message} onEdit={handleEdit} onRegenerate={handleRegenerate} />
			{/each}

			{#if waitingForFirstToken && streaming && !draftAssistant}
				<article class="chat chat-start">
					<div class="chat-bubble chat-bubble-neutral">
						<span class="loading loading-dots loading-sm" aria-label="Assistant is generating a response"></span>
					</div>
				</article>
			{:else if draftAssistant && streaming}
				<article class="chat chat-start">
					<div class="chat-bubble chat-bubble-neutral whitespace-pre-wrap">{draftAssistant}</div>
				</article>
			{/if}
		</div>

		{#if streamError}
			<p class="text-sm text-error">{streamError}</p>
		{/if}

		<ChatInput
			busy={streaming}
			onCancelGeneration={stopStreaming}
			model={model}
			onModelChange={(next) => {
				model = next;
			}}
			onSubmit={(content) => streamMessage(content, false)}
			estimatedRemaining={Math.max(0, 128000 - usedTokens)}
		/>
	</section>
{/if}


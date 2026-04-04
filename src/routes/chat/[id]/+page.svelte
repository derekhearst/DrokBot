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
	import { getAvailableModels } from '$lib/llm';
	import { getSettings } from '$lib/settings';
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
	let availableModels = $derived(await getAvailableModels());
	let appSettings = $derived(await getSettings());
	let messagesEl = $state<HTMLDivElement | undefined>(undefined);
	let consumedInitialPrompt = $state(false);
	let modelSwitchNotice = $state<string | null>(null);

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
	const estimateTokens = (value: string | null | undefined) =>
		Math.max(0, Math.ceil((value?.length ?? 0) / 4));
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

	const activeContextLimit = $derived.by(() => {
		const selected = availableModels.find((candidate) => candidate.id === model);
		return selected?.contextLength && selected.contextLength > 0 ? selected.contextLength : 128000;
	});
	const reservedResponsePct = $derived(appSettings?.contextConfig?.reservedResponsePct ?? 30);
	const autoCompactThresholdPct = $derived(appSettings?.contextConfig?.autoCompactThresholdPct ?? 72);

	const contextMetrics = $derived.by(() => {
		const totalBudget = activeContextLimit;

		const messageTokens = displayedMessages.reduce(
			(sum, message) => sum + estimateTokens(message.content),
			0
		);

		const toolResultTokens = displayedMessages.reduce((sum, message) => {
			const calls = message.toolCalls ?? [];
			for (const call of calls) {
				const resultText =
					typeof call.result === 'string' ? call.result : JSON.stringify(call.result ?? {});
				sum += estimateTokens(resultText);
			}
			return sum;
		}, 0);

		const systemTokens = 900;
		const toolDefinitionTokens = 900;
		const otherTokens = 0;

		const used = Math.min(
			totalBudget,
			systemTokens + toolDefinitionTokens + messageTokens + toolResultTokens + otherTokens
		);

		const toPct = (value: number) =>
			totalBudget > 0 ? Math.max(0, Number(((value / totalBudget) * 100).toFixed(1))) : 0;

		const modelTokenMap = new Map<string, number>();
		for (const row of stats) {
			if (row.role !== 'assistant') continue;
			const modelLabel = (row.model ?? 'unknown').split('/').at(-1) ?? row.model ?? 'unknown';
			const modelTokens = row.tokensOut > 0 ? row.tokensOut : estimateTokens(messages.find((m) => m.id === row.id)?.content);
			modelTokenMap.set(modelLabel, (modelTokenMap.get(modelLabel) ?? 0) + modelTokens);
		}

		const modelTotal = [...modelTokenMap.values()].reduce((sum, value) => sum + value, 0);
		const modelPalette = ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)', 'var(--color-info)'];
		const modelUsage = [...modelTokenMap.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([label, value], idx) => ({
				label,
				value: modelTotal > 0 ? Number(((value / modelTotal) * 100).toFixed(1)) : 0,
				color: modelPalette[idx % modelPalette.length]
			}));

		return {
			total: totalBudget,
			used,
			breakdown: {
				system: toPct(systemTokens),
				tools: toPct(toolDefinitionTokens),
				messages: toPct(messageTokens),
				results: toPct(toolResultTokens),
				other: toPct(otherTokens)
			},
			modelUsage
		};
	});

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

	function getContextLimitForModel(modelId: string) {
		const selected = availableModels.find((candidate) => candidate.id === modelId);
		return selected?.contextLength && selected.contextLength > 0 ? selected.contextLength : 128000;
	}

	async function maybeCompactBeforeModelSwitch(nextModel: string) {
		const currentModel = model;
		if (!nextModel || nextModel === currentModel) return;
		if (streaming) {
			modelSwitchNotice = 'Wait for the current response to finish before switching models.';
			setTimeout(() => {
				modelSwitchNotice = null;
			}, 3500);
			return;
		}

		const currentLimit = getContextLimitForModel(currentModel);
		const nextLimit = getContextLimitForModel(nextModel);
		const projectedPct = nextLimit > 0 ? (contextMetrics.used / nextLimit) * 100 : 0;

		if (nextLimit < currentLimit && projectedPct >= autoCompactThresholdPct) {
			const compactionPrompt = `Please compact this conversation for handoff to a model with a smaller context window. Preserve all requirements, decisions, open tasks, constraints, and the latest user intent in a concise structured summary.`;
			await streamMessage(compactionPrompt, false);
			modelSwitchNotice = `Auto-compact ran on ${currentModel.split('/').at(-1)} before switching to ${nextModel.split('/').at(-1)}.`;
			setTimeout(() => {
				modelSwitchNotice = null;
			}, 5000);
		}

		model = nextModel;
	}

	async function compactContext() {
		console.log('Compact context requested for', conversationId);
	}
</script>

{#if !conversationData}
	<p class="text-sm opacity-70">Conversation not found.</p>
{:else}
	<section class="flex min-h-0 w-full flex-1 flex-col gap-1 pt-0 pb-1">
		<!-- Inline floating top bar: title · model · context stats -->
		<div class="flex shrink-0 items-center gap-2 px-0">
			<h1 class="min-w-0 flex-1 truncate text-base font-semibold">
				{conversationData.conversation.title}
			</h1>
			<ContextWindow
				used={contextMetrics.used}
				total={contextMetrics.total}
				breakdown={contextMetrics.breakdown}
				modelUsage={contextMetrics.modelUsage}
				reservedTargetPct={reservedResponsePct}
				onCompact={compactContext}
			/>
		</div>

		{#if modelSwitchNotice}
			<div class="alert alert-info mt-1 mb-1 py-2 text-sm">
				<span>{modelSwitchNotice}</span>
			</div>
		{/if}

		<div bind:this={messagesEl} class="min-h-0 flex-1 space-y-2 overflow-y-auto px-0.5 py-1">
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

		<div class="chat-composer-transition">
			<ChatInput
				busy={streaming}
				onCancelGeneration={stopStreaming}
				model={model}
				onModelChange={(next) => maybeCompactBeforeModelSwitch(next)}
				onSubmit={(content) => streamMessage(content, false)}
				estimatedRemaining={Math.max(0, contextMetrics.total - contextMetrics.used)}
			/>
		</div>
	</section>
{/if}


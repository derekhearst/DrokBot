import { json, type RequestHandler } from '@sveltejs/kit'
import { and, asc, desc, eq, gt } from 'drizzle-orm'
import { db } from '$lib/db.server'
import { conversations, messages } from '$lib/chat/chat.schema'
import { streamChat, type LlmMessage } from '$lib/llm/openrouter'
import { routeModel } from '$lib/llm/router'
import { extractAndPersist } from '$lib/memory/extract'
import { assembleContext } from '$lib/memory/context'
import { bumpAccessCount } from '$lib/memory/store'
import { generateTitle } from '$lib/chat/titlegen'
import { emitActivity } from '$lib/activity/emit'
import { executeTool, getToolDefinitions, type ToolName, type ToolCallWithContext } from '$lib/llm/tools'
import { logLlmUsage } from '$lib/llm/usage'

const encoder = new TextEncoder()

type StreamPayload = {
	conversationId: string
	content?: string
	model?: string
	regenerate?: boolean
	attachments?: Array<{ id: string; filename: string; mimeType: string; size: number; url: string }>
}

function sse(name: string, payload: unknown) {
	return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`)
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as StreamPayload
	if (!body.conversationId) {
		return json({ error: 'conversationId is required' }, { status: 400 })
	}

	const [conversation] = await db.select().from(conversations).where(eq(conversations.id, body.conversationId)).limit(1)

	if (!conversation) {
		return json({ error: 'Conversation not found' }, { status: 404 })
	}

	const model = body.model ?? conversation.model
	const routing = await routeModel({
		content: body.content ?? '',
		explicitModel: body.model ?? undefined,
	})
	const routedModel = body.model ? model : routing.model
	let parentMessageId: string | null = null

	if (!body.regenerate) {
		if (!body.content || body.content.trim().length === 0) {
			return json({ error: 'content is required when regenerate=false' }, { status: 400 })
		}

		const [createdUser] = await db
			.insert(messages)
			.values({
				conversationId: body.conversationId,
				role: 'user',
				content: body.content.trim(),
				model,
				metadata: {},
				toolCalls: [],
				attachments: body.attachments ?? [],
			})
			.returning()

		parentMessageId = createdUser.id
	} else {
		const [lastUser] = await db
			.select()
			.from(messages)
			.where(and(eq(messages.conversationId, body.conversationId), eq(messages.role, 'user')))
			.orderBy(desc(messages.createdAt))
			.limit(1)
		parentMessageId = lastUser?.id ?? null
	}

	const historyRows = await db
		.select({ role: messages.role, content: messages.content, attachments: messages.attachments })
		.from(messages)
		.where(eq(messages.conversationId, body.conversationId))
		.orderBy(asc(messages.createdAt))

	// First exchange = only the message we just inserted exists (historyRows has exactly 1 row)
	const isFirstExchange = historyRows.length === 1 && !body.regenerate

	if (isFirstExchange) {
		void emitActivity('chat_started', `Chat started: ${conversation.title}`, {
			entityId: body.conversationId,
			entityType: 'conversation',
		})
	}

	const llmMessages: LlmMessage[] = historyRows
		.filter((row) => row.role === 'system' || row.role === 'user' || row.role === 'assistant')
		.map((row) => {
			const imageAttachments = (row.attachments ?? []).filter((a) => a.mimeType.startsWith('image/'))
			if (imageAttachments.length > 0 && row.role === 'user') {
				return {
					role: row.role,
					content: [
						{ type: 'text' as const, text: row.content },
						...imageAttachments.map((a) => ({
							type: 'image_url' as const,
							image_url: { url: a.url },
						})),
					],
				}
			}
			return { role: row.role, content: row.content }
		})

	const memoryContext = await assembleContext(body.content ?? conversation.title)
	if (memoryContext.memories.length > 0) {
		llmMessages.unshift({
			role: 'system',
			content: memoryContext.systemPrompt,
		})
		await Promise.all(memoryContext.memories.map((memory) => bumpAccessCount(memory.id)))
	}

	// Artifact creation guidance
	llmMessages.unshift({
		role: 'system',
		content: `You have access to tools including artifact_create, artifact_update, and artifact_storage_update. Use artifact_create to produce persistent, versioned artifacts for:
- Code snippets longer than ~15 lines
- Full documents, READMEs, guides, or reports
- Configuration files (YAML, JSON, TOML, etc.)
- HTML pages or SVG graphics
- Mermaid diagrams
- Data tables (as JSON arrays)
- Svelte components

For short answers, explanations, and conversational responses, reply with inline text as normal. When creating artifacts, always set an appropriate type and descriptive title.`,
	})

	const startedAt = Date.now()
	let firstTokenAt: number | null = null
	let assistantContent = ''
	let promptTokens = 0
	let completionTokens = 0

	const tools = getToolDefinitions()
	const MAX_TOOL_ROUNDS = 3

	const readable = new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				let currentMessages = [...llmMessages]
				const allToolCalls: Array<Record<string, unknown>> = []

				for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
					const stream = await streamChat(currentMessages, routedModel, tools)

					// Accumulated tool calls for this round (streamed piecewise)
					const pendingToolCalls: Array<{
						id: string
						name: string
						arguments: string
					}> = []

					assistantContent = ''

					for await (const chunk of stream) {
						const delta = chunk.choices?.[0]?.delta as
							| {
									content?: string
									tool_calls?: Array<{
										index?: number
										id?: string
										function?: { name?: string; arguments?: string }
									}>
							  }
							| undefined
						const content = delta?.content
						if (content) {
							if (firstTokenAt === null) {
								firstTokenAt = Date.now()
							}
							assistantContent += content
							controller.enqueue(sse('delta', { content }))
						}

						// Accumulate streamed tool calls
						const deltaToolCalls = delta?.tool_calls
						if (deltaToolCalls) {
							for (const tc of deltaToolCalls) {
								const idx = tc.index ?? 0
								if (!pendingToolCalls[idx]) {
									pendingToolCalls[idx] = { id: tc.id ?? '', name: '', arguments: '' }
								}
								if (tc.id) pendingToolCalls[idx].id = tc.id
								if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name
								if (tc.function?.arguments) pendingToolCalls[idx].arguments += tc.function.arguments
							}
						}

						if (chunk.usage) {
							promptTokens += chunk.usage.promptTokens ?? 0
							completionTokens += chunk.usage.completionTokens ?? 0
						}
					}

					// Check for finish_reason tool_calls or pending tool calls
					const validToolCalls = pendingToolCalls.filter((tc) => tc.name)
					if (validToolCalls.length === 0) {
						// No tool calls — we're done
						break
					}

					// Execute each tool call
					const toolResults: Array<{ call_id: string; name: string; result: string }> = []
					for (const tc of validToolCalls) {
						let parsedArgs: unknown = {}
						try {
							parsedArgs = JSON.parse(tc.arguments)
						} catch {
							// Bad JSON — skip
						}

						controller.enqueue(
							sse('tool_call', {
								id: tc.id,
								name: tc.name,
								arguments: tc.arguments,
							}),
						)

						const toolCall: ToolCallWithContext = {
							name: tc.name as ToolName,
							arguments: parsedArgs,
							conversationId: body.conversationId,
							messageId: null,
						}

						const toolResult = await executeTool(toolCall)

						const resultStr = toolResult.success ? JSON.stringify(toolResult.result) : `Error: ${toolResult.error}`

						toolResults.push({ call_id: tc.id, name: tc.name, result: resultStr })

						// Emit artifact_created if this was an artifact_create tool
						if (tc.name === 'artifact_create' && toolResult.success && toolResult.result) {
							const artifactResult = toolResult.result as { artifactId?: string; title?: string; type?: string }
							if (artifactResult.artifactId) {
								controller.enqueue(
									sse('artifact_created', {
										artifactId: artifactResult.artifactId,
										title: artifactResult.title,
										type: artifactResult.type,
									}),
								)
							}
						}

						controller.enqueue(
							sse('tool_result', {
								name: tc.name,
								success: toolResult.success,
								executionMs: toolResult.executionMs,
							}),
						)

						allToolCalls.push({
							name: tc.name,
							arguments: parsedArgs,
							result: toolResult.success ? toolResult.result : { error: toolResult.error },
							executionMs: toolResult.executionMs,
						})
					}

					// Append assistant message with tool_calls + tool results to conversation for next round
					currentMessages.push({
						role: 'assistant',
						content: assistantContent || '',
					})

					for (const tr of toolResults) {
						currentMessages.push({
							role: 'tool',
							content: tr.result,
						})
					}
				}

				const totalMs = Date.now() - startedAt
				const ttftMs = firstTokenAt ? firstTokenAt - startedAt : null
				const tokensPerSec = totalMs > 0 ? Math.round((completionTokens / (totalMs / 1000)) * 100) / 100 : null

				const messageCost = await logLlmUsage({
					source: 'chat',
					model: routedModel,
					tokensIn: promptTokens,
					tokensOut: completionTokens,
					metadata: { conversationId: body.conversationId },
				})

				const [assistantMessage] = await db
					.insert(messages)
					.values({
						conversationId: body.conversationId,
						role: 'assistant',
						content: assistantContent || '(no output)',
						model: routedModel,
						parentMessageId,
						tokensIn: promptTokens,
						tokensOut: completionTokens,
						ttftMs,
						totalMs,
						tokensPerSec,
						cost: messageCost,
						metadata: {
							routing: { tier: routing.tier, reason: routing.reason, budgetDowngraded: routing.budgetDowngraded },
						},
						toolCalls: allToolCalls,
					})
					.returning()

				// Link any artifacts created in this exchange to this message
				if (allToolCalls.length > 0) {
					const { artifacts: artifactsTable } = await import('$lib/artifacts/artifacts.schema')
					for (const tc of allToolCalls) {
						if (tc.name === 'artifact_create') {
							const result = tc.result as { artifactId?: string } | undefined
							if (result?.artifactId) {
								await db
									.update(artifactsTable)
									.set({ messageId: assistantMessage.id })
									.where(eq(artifactsTable.id, result.artifactId))
							}
						}
					}
				}

				await db
					.update(conversations)
					.set({
						model: routedModel,
						totalTokens: conversation.totalTokens + promptTokens + completionTokens,
						totalCost: String(parseFloat(conversation.totalCost) + parseFloat(messageCost)),
						updatedAt: new Date(),
					})
					.where(eq(conversations.id, body.conversationId))

				if (isFirstExchange && body.content) {
					void generateTitle([
						{ role: 'user', content: body.content.trim() },
						{ role: 'assistant', content: assistantContent || '' },
					])
						.then((title) => db.update(conversations).set({ title }).where(eq(conversations.id, body.conversationId)))
						.catch(() => {
							// Non-critical — title stays as default
						})
				}

				const extractionMessages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }> = []
				if (!body.regenerate && body.content?.trim()) {
					extractionMessages.push({ role: 'user', content: body.content.trim() })
				}
				extractionMessages.push({ role: 'assistant', content: assistantContent || '(no output)' })
				void extractAndPersist(extractionMessages).catch(() => {
					// Ignore extraction failures to avoid impacting chat streaming.
				})

				controller.enqueue(
					sse('metrics', {
						model: routedModel,
						tokensIn: promptTokens,
						tokensOut: completionTokens,
						ttftMs,
						totalMs,
						tokensPerSec,
						cost: parseFloat(messageCost),
						routing: { tier: routing.tier, reason: routing.reason, budgetDowngraded: routing.budgetDowngraded },
					}),
				)
				controller.enqueue(sse('done', { messageId: assistantMessage.id }))
				controller.close()
			} catch (error) {
				controller.enqueue(
					sse('done', {
						error: error instanceof Error ? error.message : 'Failed to stream response',
					}),
				)
				controller.close()
			}
		},
	})

	return new Response(readable, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		},
	})
}

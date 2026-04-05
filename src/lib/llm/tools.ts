import { z } from 'zod'
import { webSearch } from '$lib/tools/search'
import { browserNavigate, browserScreenshot, execCode, execShell, readFile, writeFile } from '$lib/tools/sandbox'
import { searchMemories } from '$lib/memory/store'
import { createTaskForAvailableAgent, delegateTaskToAgent } from '$lib/agents/engine'
import { generateImage } from '$lib/tools/imagegen'
import { db } from '$lib/db.server'
import { artifacts, artifactVersions } from '$lib/artifacts/artifacts.schema'
import { eq, max } from 'drizzle-orm'

export const toolSchemas = {
	web_search: z.object({ query: z.string().min(1) }),
	code_execute: z.object({ code: z.string().min(1), language: z.string().default('typescript') }),
	file_read: z.object({ path: z.string().min(1) }),
	file_write: z.object({ path: z.string().min(1), content: z.string() }),
	browser_screenshot: z.object({ url: z.string().url().optional() }),
	memory_search: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(20).default(5) }),
	create_task: z.object({ title: z.string().min(1), description: z.string().min(1) }),
	delegate_to_agent: z.object({ agentId: z.string().uuid(), task: z.string().min(1) }),
	image_generate: z.object({
		prompt: z.string().min(1).max(2000),
		model: z.enum(['flux', 'sdxl', 'dall-e']).default('flux'),
		size: z.enum(['256x256', '512x512', '1024x1024']).default('1024x1024'),
	}),
	artifact_create: z.object({
		type: z.enum([
			'markdown',
			'code',
			'config',
			'image',
			'svg',
			'mermaid',
			'html',
			'svelte',
			'data_table',
			'chart',
			'audio',
			'video',
		]),
		title: z.string().min(1).max(200),
		content: z.string(),
		language: z.string().max(60).optional(),
		category: z.string().max(60).optional(),
	}),
	artifact_update: z.object({
		artifactId: z.string().uuid(),
		content: z.string(),
		title: z.string().min(1).max(200).optional(),
	}),
	artifact_storage_update: z.object({
		artifactId: z.string().uuid(),
		key: z.string().min(1).max(200),
		value: z.unknown(),
	}),
}

export type ToolName = keyof typeof toolSchemas

const toolDescriptions: Record<ToolName, string> = {
	web_search: 'Search the web for information.',
	code_execute: 'Execute code in a sandboxed environment.',
	file_read: 'Read a file from the sandbox filesystem.',
	file_write: 'Write content to a file in the sandbox filesystem.',
	browser_screenshot: 'Take a screenshot of a web page.',
	memory_search: 'Search persistent memory for relevant information.',
	create_task: 'Create a new agent task.',
	delegate_to_agent: 'Delegate a task to a specific agent.',
	image_generate: 'Generate an image from a text prompt.',
	artifact_create:
		'Create a persistent artifact (document, code, config, diagram, etc.). Use for code snippets over 15 lines, full documents, configs, diagrams, data tables, HTML pages, and Svelte components.',
	artifact_update: 'Update the content of an existing artifact. Creates a new version automatically.',
	artifact_storage_update:
		"Update a key in an artifact's persistent storage. Used for reactive/living artifacts like trackers and dashboards.",
}

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
	return z.toJSONSchema(schema) as Record<string, unknown>
}

export function getToolDefinitions() {
	return Object.entries(toolSchemas).map(([name, schema]) => ({
		type: 'function' as const,
		function: {
			name,
			description: toolDescriptions[name as ToolName],
			parameters: zodToJsonSchema(schema),
		},
	}))
}

export type ToolCall = {
	name: ToolName
	arguments: unknown
}

export type ToolCallWithContext = ToolCall & {
	conversationId?: string | null
	messageId?: string | null
}

export async function executeTool(call: ToolCall) {
	const startedAt = Date.now()
	try {
		if (call.name === 'web_search') {
			const input = toolSchemas.web_search.parse(call.arguments)
			return {
				success: true,
				tool: call.name,
				input,
				result: await webSearch(input.query),
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'code_execute') {
			const input = toolSchemas.code_execute.parse(call.arguments)
			return {
				success: true,
				tool: call.name,
				input,
				result: await execCode(input.code, input.language),
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'file_read') {
			const input = toolSchemas.file_read.parse(call.arguments)
			return {
				success: true,
				tool: call.name,
				input,
				result: await readFile(input.path),
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'file_write') {
			const input = toolSchemas.file_write.parse(call.arguments)
			return {
				success: true,
				tool: call.name,
				input,
				result: await writeFile(input.path, input.content),
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'browser_screenshot') {
			const input = toolSchemas.browser_screenshot.parse(call.arguments)
			return {
				success: true,
				tool: call.name,
				input,
				result: await browserScreenshot(input.url),
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'memory_search') {
			const input = toolSchemas.memory_search.parse(call.arguments)
			const matches = await searchMemories(input.query, input.limit)
			return {
				success: true,
				tool: call.name,
				input,
				result: matches,
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'create_task') {
			const input = toolSchemas.create_task.parse(call.arguments)
			const task = await createTaskForAvailableAgent(input.title, input.description)
			return {
				success: true,
				tool: call.name,
				input,
				result: task,
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'image_generate') {
			const input = toolSchemas.image_generate.parse(call.arguments)
			const result = await generateImage(input.prompt, input.model, input.size)
			return {
				success: true,
				tool: call.name,
				input,
				result,
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'artifact_create') {
			const input = toolSchemas.artifact_create.parse(call.arguments)
			const [artifact] = await db
				.insert(artifacts)
				.values({
					type: input.type,
					title: input.title,
					content: input.content,
					language: input.language ?? null,
					category: input.category ?? null,
					conversationId: (call as ToolCallWithContext).conversationId ?? null,
					messageId: (call as ToolCallWithContext).messageId ?? null,
				})
				.returning()

			await db.insert(artifactVersions).values({
				artifactId: artifact.id,
				version: 1,
				content: input.content,
				language: input.language ?? null,
				metadata: {},
			})

			return {
				success: true,
				tool: call.name,
				input,
				result: { artifactId: artifact.id, title: artifact.title, type: artifact.type },
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'artifact_update') {
			const input = toolSchemas.artifact_update.parse(call.arguments)

			const [existing] = await db.select().from(artifacts).where(eq(artifacts.id, input.artifactId)).limit(1)
			if (!existing) {
				return { success: false, tool: call.name, error: 'Artifact not found', executionMs: Date.now() - startedAt }
			}

			const updates: Record<string, unknown> = { content: input.content, updatedAt: new Date() }
			if (input.title) updates.title = input.title

			await db.update(artifacts).set(updates).where(eq(artifacts.id, input.artifactId))

			// Auto-version
			const [maxRow] = await db
				.select({ maxVersion: max(artifactVersions.version) })
				.from(artifactVersions)
				.where(eq(artifactVersions.artifactId, input.artifactId))

			const nextVersion = (maxRow?.maxVersion ?? 0) + 1
			await db.insert(artifactVersions).values({
				artifactId: input.artifactId,
				version: nextVersion,
				content: input.content,
				language: existing.language,
				metadata: {},
			})

			return {
				success: true,
				tool: call.name,
				input,
				result: { artifactId: input.artifactId, version: nextVersion },
				executionMs: Date.now() - startedAt,
			}
		}

		if (call.name === 'artifact_storage_update') {
			const input = toolSchemas.artifact_storage_update.parse(call.arguments)

			const [existing] = await db
				.select({ storage: artifacts.storage })
				.from(artifacts)
				.where(eq(artifacts.id, input.artifactId))
				.limit(1)

			if (!existing) {
				return { success: false, tool: call.name, error: 'Artifact not found', executionMs: Date.now() - startedAt }
			}

			const newStorage = { ...existing.storage, [input.key]: input.value }
			await db
				.update(artifacts)
				.set({ storage: newStorage, updatedAt: new Date() })
				.where(eq(artifacts.id, input.artifactId))

			return {
				success: true,
				tool: call.name,
				input,
				result: { artifactId: input.artifactId, updatedKey: input.key },
				executionMs: Date.now() - startedAt,
			}
		}

		const input = toolSchemas.delegate_to_agent.parse(call.arguments)
		const delegated = await delegateTaskToAgent(input.agentId, input.task)
		return {
			success: true,
			tool: call.name,
			input,
			result: delegated,
			executionMs: Date.now() - startedAt,
		}
	} catch (error) {
		return {
			success: false,
			tool: call.name,
			error: error instanceof Error ? error.message : 'Tool execution failed',
			executionMs: Date.now() - startedAt,
		}
	}
}

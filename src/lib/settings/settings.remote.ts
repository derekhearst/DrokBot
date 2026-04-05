import { command, query } from '$app/server'
import { z } from 'zod'
import { getOrCreateSettings, resetSettings, updateSettings } from '$lib/settings/settings'
import { getToolDefinitions } from '$lib/llm/tools'
import { listSkillSummaries } from '$lib/skills/store'
import { assembleContext } from '$lib/memory/context'

const settingsUpdateSchema = z.object({
	defaultModel: z.string().trim().min(1).max(120).optional(),
	theme: z.enum(['drokbot-night']).optional(),
	notificationPrefs: z
		.object({
			taskCompleted: z.boolean().optional(),
			needsInput: z.boolean().optional(),
			dreamSummary: z.boolean().optional(),
			agentErrors: z.boolean().optional(),
		})
		.optional(),
	dreamConfig: z
		.object({
			autoRun: z.boolean().optional(),
			frequencyHours: z
				.number()
				.int()
				.min(1)
				.max(24 * 30)
				.optional(),
			aggressiveness: z.number().min(0).max(1).optional(),
		})
		.optional(),
	budgetConfig: z
		.object({
			dailyLimit: z.number().min(0).nullable().optional(),
			monthlyLimit: z.number().min(0).nullable().optional(),
		})
		.optional(),
	contextConfig: z
		.object({
			reservedResponsePct: z.number().min(10).max(40).optional(),
			autoCompactThresholdPct: z.number().min(40).max(95).optional(),
		})
		.optional(),
	toolConfig: z
		.object({
			approvalMode: z.enum(['auto', 'confirm']).optional(),
		})
		.optional(),
	systemPrompt: z.string().max(12000).optional(),
})

export const getSettings = query(async () => {
	return getOrCreateSettings()
})

export const updateAppSettings = command(settingsUpdateSchema, async (input) => {
	return updateSettings(input)
})

export const resetAppSettings = command(async () => {
	return resetSettings()
})

export const getFullPromptPreview = query(async () => {
	const settings = await getOrCreateSettings()

	const systemMessages: Array<{ label: string; content: string }> = []

	// Skills awareness (prepended first, so appears at top)
	const skillSummaries = await listSkillSummaries()
	if (skillSummaries.length > 0) {
		const skillList = skillSummaries
			.map((s) => {
				const fileNames = s.files.map((f: { name: string }) => f.name).join(', ')
				return `- ${s.name}: ${s.description}${fileNames ? ` [files: ${fileNames}]` : ''}`
			})
			.join('\n')
		systemMessages.push({
			label: 'Skills Awareness',
			content: `Available skills (use read_skill tool to load full content when relevant):\n${skillList}`,
		})
	}

	// Artifact creation guidance
	const artifactGuidance = `You have access to tools including artifact_create, artifact_update, and artifact_storage_update. Use artifact_create to produce persistent, versioned artifacts for:
- Code snippets longer than ~15 lines
- Full documents, READMEs, guides, or reports
- Configuration files (YAML, JSON, TOML, etc.)
- HTML pages or SVG graphics
- Mermaid diagrams
- Data tables (as JSON arrays)
- Svelte components

For short answers, explanations, and conversational responses, reply with inline text as normal. When creating artifacts, always set an appropriate type and descriptive title.`
	systemMessages.push({ label: 'Artifact Guidance', content: artifactGuidance })

	// Custom system prompt
	if (settings.systemPrompt) {
		systemMessages.push({ label: 'Custom System Prompt', content: settings.systemPrompt })
	}

	// Memory context (sample)
	const memoryContext = await assembleContext('sample conversation')
	if (memoryContext.memories.length > 0) {
		systemMessages.push({ label: 'Memory Context (sample)', content: memoryContext.systemPrompt })
	}

	// Tool definitions
	const tools = getToolDefinitions()

	return {
		systemMessages,
		tools,
		model: settings.defaultModel,
		toolApprovalMode: (settings.toolConfig as { approvalMode?: string } | undefined)?.approvalMode ?? 'auto',
	}
})

import type { ToolName } from '$lib/llm/tools'

/**
 * Capability groups that organize tools into logical bundles.
 * Only the groups detected as relevant are loaded per message,
 * reducing token usage and improving model focus.
 */
export const capabilityGroups = {
	core: {
		label: 'Core',
		description: 'Web search and memory lookup',
		tools: ['web_search', 'memory_search'] as ToolName[],
		alwaysOn: true,
	},
	sandbox: {
		label: 'Coding Sandbox',
		description: 'Execute code, read/write files, browser screenshots',
		tools: ['code_execute', 'file_read', 'file_write', 'browser_screenshot'] as ToolName[],
		alwaysOn: false,
	},
	artifacts: {
		label: 'Artifacts',
		description: 'Create and update persistent versioned documents, code, diagrams, and more',
		tools: ['artifact_create', 'artifact_update', 'artifact_storage_update'] as ToolName[],
		alwaysOn: false,
	},
	skills: {
		label: 'Skills',
		description: 'Browse, read, create, and manage reusable skill/knowledge bundles',
		tools: [
			'list_skills',
			'read_skill',
			'read_skill_file',
			'create_skill',
			'update_skill',
			'add_skill_file',
			'update_skill_file',
			'delete_skill',
			'delete_skill_file',
		] as ToolName[],
		alwaysOn: false,
	},
	agents: {
		label: 'Agents',
		description: 'Create tasks and run sub-agents for delegation',
		tools: ['create_task', 'run_subagent'] as ToolName[],
		alwaysOn: false,
	},
	media: {
		label: 'Image Generation',
		description: 'Generate images from text prompts',
		tools: ['image_generate'] as ToolName[],
		alwaysOn: false,
	},
} as const satisfies Record<string, { label: string; description: string; tools: ToolName[]; alwaysOn: boolean }>

export type CapabilityGroup = keyof typeof capabilityGroups

// Reverse lookup: tool name → group
const toolToGroup: Record<string, CapabilityGroup> = {}
for (const [groupName, group] of Object.entries(capabilityGroups)) {
	for (const tool of group.tools) {
		toolToGroup[tool] = groupName as CapabilityGroup
	}
}

export function getGroupForTool(toolName: string): CapabilityGroup | undefined {
	return toolToGroup[toolName]
}

/**
 * Detection patterns for each capability group.
 * Patterns are tested case-insensitively against the user message.
 */
const detectionPatterns: Record<Exclude<CapabilityGroup, 'core'>, RegExp[]> = {
	sandbox: [
		/\b(code|script|program|function|execute|run|compile|debug|terminal|shell|bash)\b/i,
		/\b(file|read|write|save|open|create\s+a?\s*file|edit\s+file)\b/i,
		/\b(python|javascript|typescript|node|java|c\+\+|rust|go|ruby)\b/i,
		/\b(screenshot|browser|webpage|scrape)\b/i,
		/```[\s\S]/,
	],
	artifacts: [
		/\b(artifact|document|report|readme|guide|create\s+a\s+\w+\s+(page|doc|table|chart|diagram))\b/i,
		/\b(mermaid|svg|html\s+(page|component)|svelte\s+component|data\s+table)\b/i,
		/\b(diagram|flowchart|sequence\s+diagram|chart|graph|visualization)\b/i,
		/\b(markdown\s+(doc|file|document)|config\s+file)\b/i,
	],
	skills: [
		/\b(skill|teach\s+(you|yourself)|learn|knowledge\s+bundle)\b/i,
		/\b(create\s+skill|update\s+skill|delete\s+skill|read\s+skill|list\s+skills)\b/i,
	],
	agents: [
		/\b(task|agent|delegate|background\s+job|subagent|sub\s*-?\s*agent)\b/i,
		/\b(create\s+task|run\s+task|assign|autonomous)\b/i,
	],
	media: [
		/\b(image|picture|photo|draw|illustrat|generat\w*\s+(?:an?\s+)?image|generat\w*\s+(?:an?\s+)?picture)\b/i,
		/\b(dall-?e|flux|sdxl|stable\s+diffusion)\b/i,
	],
}

export type CapabilityOverride = 'auto' | 'always' | 'off'

/**
 * Detects which capability groups should be activated for the current message.
 *
 * Sources:
 *  1. User overrides from settings (always/off skip detection)
 *  2. Keyword heuristics on the current user message
 *  3. Previously-used tool groups from conversation history (sticky activation)
 *
 * Core is always included. Returns a deduplicated sorted list.
 */
export function detectCapabilities(
	userMessage: string,
	previousToolNames?: string[],
	overrides?: Record<string, CapabilityOverride>,
): CapabilityGroup[] {
	const active = new Set<CapabilityGroup>(['core'])

	const allGroups = Object.keys(capabilityGroups) as CapabilityGroup[]

	for (const group of allGroups) {
		const override = overrides?.[group]

		if (override === 'off') continue
		if (override === 'always') {
			active.add(group)
			continue
		}

		// 'auto' or no override — use heuristics
		if (group !== 'core' && group in detectionPatterns) {
			const patterns = detectionPatterns[group as keyof typeof detectionPatterns]
			if (patterns.some((p) => p.test(userMessage))) {
				active.add(group)
			}
		}
	}

	// Sticky: if the conversation previously used tools from a group, keep it active
	if (previousToolNames) {
		for (const name of previousToolNames) {
			const group = toolToGroup[name]
			if (group && overrides?.[group] !== 'off') active.add(group)
		}
	}

	return [...active]
}

/**
 * Returns the list of ToolNames that should be active given the detected capabilities.
 */
export function getActiveTools(capabilities: CapabilityGroup[]): ToolName[] {
	const tools = new Set<ToolName>()
	for (const cap of capabilities) {
		for (const tool of capabilityGroups[cap].tools) {
			tools.add(tool)
		}
	}
	return [...tools]
}

/**
 * Builds a concise system prompt section describing available capabilities.
 * Active groups get full descriptions; inactive groups get a one-liner
 * so the LLM knows it can request them if needed.
 */
export function buildCapabilityPrompt(
	activeCapabilities: CapabilityGroup[],
	options?: { customSystemPrompt?: string; skillSummaries?: string },
): string {
	const sections: string[] = []

	// Custom system prompt first (static — best for prompt caching)
	if (options?.customSystemPrompt) {
		sections.push(options.customSystemPrompt)
	}

	const activeSet = new Set(activeCapabilities)

	// Inactive capabilities summary
	const inactiveGroups = (Object.keys(capabilityGroups) as CapabilityGroup[]).filter((g) => !activeSet.has(g))

	if (inactiveGroups.length > 0) {
		const inactiveList = inactiveGroups
			.map((g) => `${capabilityGroups[g].label} (${capabilityGroups[g].description})`)
			.join(', ')
		sections.push(
			`Additional capabilities available on demand: ${inactiveList}. If you need one of these, just use the relevant tool — it will be provided automatically.`,
		)
	}

	// Artifact guidance — only when artifacts group is active
	if (activeSet.has('artifacts')) {
		sections.push(
			`Use artifact_create to produce persistent, versioned artifacts for: code snippets over ~15 lines, full documents/reports, configuration files, HTML/SVG, Mermaid diagrams, data tables, and Svelte components. For short answers, reply inline as normal.`,
		)
	}

	// Skills awareness — only when skills are active or there are skill summaries
	if (options?.skillSummaries) {
		sections.push(`Available skills (use read_skill to load full content when relevant):\n${options.skillSummaries}`)
	}

	return sections.join('\n\n')
}

/**
 * Model context window sizes (in tokens) for compaction calculations.
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
	'anthropic/claude-sonnet-4': 200_000,
	'anthropic/claude-opus-4': 200_000,
	'openai/gpt-4o-mini': 128_000,
}

export function getContextWindowSize(model: string): number {
	return MODEL_CONTEXT_WINDOWS[model] ?? 200_000
}

/**
 * Rough token estimate: ~4 chars per token.
 */
export function estimateTokens(text: string): number {
	return Math.ceil((text?.length ?? 0) / 4)
}

/**
 * Estimate the token count of a tool definition (JSON schema).
 */
export function estimateToolDefinitionTokens(
	tools: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>,
): number {
	return estimateTokens(JSON.stringify(tools))
}

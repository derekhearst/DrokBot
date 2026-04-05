import { searchMemories } from '$lib/memory/store'

const GREETING_PATTERN =
	/^(h(i|ey|ello|owdy)|yo|sup|what'?s\s*up|good\s*(morning|evening|afternoon)|thanks?|ok|yes|no|gm)\b/i
const TRIVIAL_MAX_LENGTH = 20

/**
 * Decide whether memory context is worth fetching for this message.
 * Skip for trivial greetings or very short messages with no substance.
 */
export function shouldFetchMemory(content: string): boolean {
	const trimmed = content.trim()
	if (trimmed.length <= TRIVIAL_MAX_LENGTH && GREETING_PATTERN.test(trimmed)) return false
	return true
}

export async function assembleContext(conversationTopic?: string, options?: { limit?: number }) {
	const query = conversationTopic?.trim() || 'user preferences and current project context'
	const limit = options?.limit ?? 8
	const memories = await searchMemories(query, limit)

	const bulletPoints = memories.map((memory, index) => `${index + 1}. [${memory.category}] ${memory.content}`)
	return {
		query,
		memories,
		systemPrompt: [
			'Relevant long-term memories for this conversation:',
			...bulletPoints,
			'Use these as soft constraints. Prefer newer facts when conflicts exist.',
		].join('\n'),
	}
}

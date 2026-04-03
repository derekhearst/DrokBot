import { searchMemories } from '$lib/server/memory/store'

export async function assembleContext(conversationTopic?: string) {
	const query = conversationTopic?.trim() || 'user preferences and current project context'
	const memories = await searchMemories(query, 12)

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

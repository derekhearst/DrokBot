import { chat } from '$lib/llm/openrouter'
import { createMemory, listMemories } from '$lib/memory/store'
import { deduplicateMemories, createRelations } from '$lib/memory/extract'
import { emitActivity } from '$lib/activity/emit'

export async function buildImportPrompt(options?: { includeExisting?: boolean }) {
	let existingContext = ''

	if (options?.includeExisting) {
		const existing = await listMemories({ limit: 200 })
		if (existing.length > 0) {
			const categoryCounts = new Map<string, number>()
			for (const m of existing) {
				categoryCounts.set(m.category, (categoryCounts.get(m.category) ?? 0) + 1)
			}
			const summary = [...categoryCounts.entries()].map(([cat, count]) => `${cat}: ${count}`).join(', ')

			existingContext = [
				'',
				'I already have these memory categories stored: ' + summary + '.',
				'Skip facts I likely already know and focus on new or unique information.',
			].join('\n')
		}
	}

	return [
		'I use a personal AI assistant that stores long-term memories about me.',
		'Please help me transfer knowledge from our conversations here into my assistant.',
		'',
		'List everything you know about me as concise, standalone facts — one fact per line.',
		'Cover these categories:',
		'- **preference** — likes, dislikes, communication style, tools I prefer',
		"- **project** — things I'm working on, tech stack, goals",
		"- **person** — people I've mentioned, relationships, roles",
		"- **constraint** — limitations, deadlines, requirements I've stated",
		'- **general** — anything else noteworthy',
		'',
		'Format each fact as a single clear sentence. Do not use bullet markers or numbering.',
		'Do not include uncertain or speculative information.',
		'Do not include facts about yourself or our conversation mechanics.',
		existingContext,
	]
		.join('\n')
		.trim()
}

export async function extractFromImportText(text: string, model?: string) {
	if (!text.trim()) return { imported: 0, memories: [] }

	const response = await chat(
		[
			{
				role: 'system',
				content: [
					'You parse user-provided text into structured memory facts for an AI assistant.',
					'Return a JSON array of objects with keys: content (string), category (string), importance (number 0-1).',
					'Valid categories: general, preference, project, person, constraint.',
					'Set importance based on how durable/significant the fact is (0.3 for trivial, 0.5 for normal, 0.7+ for key identity/project facts).',
					'Each memory should be a single concise sentence.',
					'If the input contains no useful facts, return [].',
				].join('\n'),
			},
			{
				role: 'user',
				content: ['Parse the following text into individual memory facts.\n', text].join('\n'),
			},
		],
		model ?? 'openai/gpt-4o-mini',
	)

	let extracted: Array<{ content: string; category: string; importance: number }>
	try {
		const raw = response.content.replace(/^```json?\s*|```$/gm, '').trim()
		const parsed = JSON.parse(raw) as Array<{ content: string; category: string; importance: number }>
		extracted = parsed
			.filter((item) => typeof item.content === 'string' && item.content.trim().length > 0)
			.map((item) => ({
				content: item.content.trim(),
				category: ['general', 'preference', 'project', 'person', 'constraint'].includes(item.category)
					? item.category
					: 'general',
				importance: Math.max(0, Math.min(1, Number(item.importance ?? 0.5))),
			}))
	} catch {
		return { imported: 0, memories: [] }
	}

	const unique = await deduplicateMemories(extracted)
	const created: Array<{ content: string; category: string; importance: number }> = []

	for (const memory of unique) {
		const row = await createMemory(memory.content, memory.category, memory.importance)
		await createRelations(row.id, row.content, row.importance)
		created.push({ content: row.content, category: row.category, importance: row.importance })
		void emitActivity('memory_created', `Memory imported: ${memory.content.slice(0, 100)}`, {
			entityId: row.id,
			entityType: 'memory',
			metadata: { category: memory.category, importance: memory.importance, source: 'import' },
		})
	}

	return { imported: created.length, memories: created }
}

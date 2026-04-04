import { query } from '$app/server'
import { z } from 'zod'
import { webSearch } from '$lib/tools/search'

const searchSchema = z.object({
	query: z.string().trim().min(1),
	limit: z.number().int().min(1).max(20).default(8),
})

export const searchWeb = query(searchSchema, async (input) => {
	return webSearch(input.query, input.limit)
})

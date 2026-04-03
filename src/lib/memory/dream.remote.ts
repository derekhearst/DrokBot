import { command } from '$app/server'
import { query } from '$app/server'
import { z } from 'zod'
import { listDreamCycles, runDreamCycle } from '$lib/server/memory/dream'

const runDreamCycleSchema = z.object({
	decayLambda: z.number().positive().max(1).optional(),
	pruneThreshold: z.number().min(0).max(1).optional(),
	topCount: z.number().int().min(1).max(200).optional(),
	conversationLimit: z.number().int().min(1).max(50).optional(),
	lookbackHours: z
		.number()
		.int()
		.min(1)
		.max(24 * 30)
		.optional(),
})

const listDreamCyclesSchema = z.object({
	limit: z.number().int().min(1).max(100).optional(),
})

export const runDreamCycleCommand = command(
	runDreamCycleSchema,
	async ({ decayLambda, pruneThreshold, topCount, conversationLimit, lookbackHours }) => {
		return runDreamCycle({ decayLambda, pruneThreshold, topCount, conversationLimit, lookbackHours })
	},
)

export const listDreamCyclesQuery = query(listDreamCyclesSchema, async ({ limit }) => {
	return listDreamCycles(limit ?? 20)
})

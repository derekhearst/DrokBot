import { command, query } from '$app/server'
import { asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '$lib/db.server'
import { agents, agentTasks } from '$lib/agents/agents.schema'
import {
	createAgentTask,
	delegateTaskToAgent,
	executeAgentTask,
	getAgentDashboard,
	listAgentsWithCounts,
} from '$lib/agents/engine'
import { getSchedulerSnapshot, runSchedulerTick, runSchedulerUntilIdle } from '$lib/agents/scheduler'

const agentIdSchema = z.string().uuid()

const createAgentSchema = z.object({
	name: z.string().trim().min(1).max(80),
	role: z.string().trim().min(1).max(120),
	systemPrompt: z.string().trim().min(1).max(12000),
	model: z.string().trim().min(1).max(120).optional(),
	parentAgentId: z.string().uuid().optional(),
})

const updateAgentStatusSchema = z.object({
	agentId: z.string().uuid(),
	status: z.enum(['active', 'paused', 'idle']),
})

const createAgentTaskSchema = z.object({
	agentId: z.string().uuid(),
	title: z.string().trim().min(1).max(160),
	description: z.string().trim().min(1).max(20000),
	priority: z.number().int().min(0).max(5).optional(),
})

const runTaskSchema = z.object({
	taskId: z.string().uuid(),
})

const schedulerTickSchema = z.object({
	maxConcurrent: z.number().int().min(1).max(6).optional(),
})

const schedulerDrainSchema = z.object({
	maxConcurrent: z.number().int().min(1).max(6).optional(),
	maxTicks: z.number().int().min(1).max(50).optional(),
})

const delegateSchema = z.object({
	agentId: z.string().uuid(),
	task: z.string().trim().min(1),
	sourceTaskId: z.string().uuid().optional(),
})

export const listAgents = query(async () => {
	return listAgentsWithCounts()
})

export const getAgent = query(agentIdSchema, async (agentId) => {
	return getAgentDashboard(agentId)
})

export const getAgentChoices = query(async () => {
	return db
		.select({ id: agents.id, name: agents.name, status: agents.status })
		.from(agents)
		.orderBy(asc(agents.createdAt))
})

export const createAgent = command(createAgentSchema, async (input) => {
	const [created] = await db
		.insert(agents)
		.values({
			name: input.name,
			role: input.role,
			systemPrompt: input.systemPrompt,
			model: input.model ?? 'anthropic/claude-sonnet-4',
			status: 'idle',
			parentAgentId: input.parentAgentId,
		})
		.returning()

	return created
})

export const updateAgentStatus = command(updateAgentStatusSchema, async ({ agentId, status }) => {
	const [updated] = await db.update(agents).set({ status }).where(eq(agents.id, agentId)).returning()
	return updated
})

export const createTask = command(createAgentTaskSchema, async (input) => {
	return createAgentTask(input)
})

export const runTaskNow = command(runTaskSchema, async ({ taskId }) => {
	return executeAgentTask(taskId)
})

export const runSchedulerTickCommand = command(schedulerTickSchema, async ({ maxConcurrent }) => {
	return runSchedulerTick({ maxConcurrent })
})

export const runSchedulerDrainCommand = command(schedulerDrainSchema, async ({ maxConcurrent, maxTicks }) => {
	return runSchedulerUntilIdle({ maxConcurrent, maxTicks })
})

export const schedulerSnapshot = query(async () => {
	return getSchedulerSnapshot()
})

export const previewQueue = query(async () => {
	return db
		.select({
			id: agentTasks.id,
			title: agentTasks.title,
			agentId: agentTasks.agentId,
			priority: agentTasks.priority,
			status: agentTasks.status,
			createdAt: agentTasks.createdAt,
		})
		.from(agentTasks)
		.where(eq(agentTasks.status, 'pending'))
		.orderBy(desc(agentTasks.priority), asc(agentTasks.createdAt))
		.limit(50)
})

export const delegateTask = command(delegateSchema, async ({ agentId, task, sourceTaskId }) => {
	return delegateTaskToAgent(agentId, task, sourceTaskId)
})

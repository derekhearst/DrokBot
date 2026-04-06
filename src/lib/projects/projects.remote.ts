import { command, getRequestEvent, query } from '$app/server'
import { z } from 'zod'
import {
	approveStrategy,
	createDraftStrategy,
	createGoalForProject,
	createProjectForUser,
	getProjectForUser,
	listGoalsForProject,
	listProjectsForUser,
	listStrategiesForProject,
	rejectStrategy,
	submitStrategy,
	updateGoalStatusForProject,
	updateProjectStatusForUser,
} from '$lib/projects/projects.server'
import { requireAuthenticatedRequestUser } from '$lib/auth/auth.server'

const projectIdSchema = z.object({
	projectId: z.string().uuid(),
})

const strategyStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected', 'active', 'superseded'])

export const listProjectsQuery = query(
	z.object({ includeArchived: z.boolean().optional() }).optional(),
	async (input) => {
		const user = requireAuthenticatedRequestUser()
		return listProjectsForUser(user.id, { includeArchived: input?.includeArchived })
	},
)

export const getProjectByIdQuery = query(projectIdSchema, async ({ projectId }) => {
	const user = requireAuthenticatedRequestUser()
	return getProjectForUser(projectId, user.id)
})

export const createProjectCommand = command(
	z.object({
		name: z.string().trim().min(1).max(120),
		description: z.string().trim().max(4000).optional(),
	}),
	async ({ name, description }) => {
		const user = requireAuthenticatedRequestUser()
		return createProjectForUser({ ownerUserId: user.id, name, description: description ?? null })
	},
)

export const setProjectStatusCommand = command(
	z.object({
		projectId: z.string().uuid(),
		status: z.enum(['active', 'archived', 'deleted']),
	}),
	async ({ projectId, status }) => {
		const user = requireAuthenticatedRequestUser()
		return updateProjectStatusForUser({ projectId, userId: user.id, status })
	},
)

export const listProjectGoalsQuery = query(projectIdSchema, async ({ projectId }) => {
	const user = requireAuthenticatedRequestUser()
	return listGoalsForProject({ projectId, userId: user.id })
})

export const createProjectGoalCommand = command(
	z.object({
		projectId: z.string().uuid(),
		title: z.string().trim().min(1).max(240),
		description: z.string().trim().max(12000).optional(),
		parentGoalId: z.string().uuid().optional(),
		priority: z.number().int().min(0).max(5).optional(),
	}),
	async ({ projectId, title, description, parentGoalId, priority }) => {
		const user = requireAuthenticatedRequestUser()
		return createGoalForProject({
			projectId,
			userId: user.id,
			title,
			description,
			parentGoalId,
			priority,
		})
	},
)

export const setProjectGoalStatusCommand = command(
	z.object({
		projectId: z.string().uuid(),
		goalId: z.string().uuid(),
		status: z.enum(['planned', 'active', 'blocked', 'completed', 'archived']),
	}),
	async ({ projectId, goalId, status }) => {
		const user = requireAuthenticatedRequestUser()
		return updateGoalStatusForProject({ projectId, goalId, userId: user.id, status })
	},
)

export const listProjectStrategiesQuery = query(
	z.object({
		projectId: z.string().uuid(),
		statuses: z.array(strategyStatusSchema).optional(),
	}),
	async ({ projectId, statuses }) => {
		const user = requireAuthenticatedRequestUser()
		return listStrategiesForProject({ projectId, userId: user.id, statuses })
	},
)

export const createDraftStrategyCommand = command(
	z.object({
		projectId: z.string().uuid(),
		goalId: z.string().uuid().optional(),
		title: z.string().trim().min(1).max(240),
		summary: z.string().trim().min(1).max(4000),
		details: z.string().trim().max(24000).optional(),
		proposedByAgentName: z.string().trim().max(120).optional(),
	}),
	async ({ projectId, goalId, title, summary, details, proposedByAgentName }) => {
		const user = requireAuthenticatedRequestUser()
		return createDraftStrategy({
			projectId,
			goalId,
			userId: user.id,
			title,
			summary,
			details,
			proposedByAgentName,
		})
	},
)

export const submitStrategyCommand = command(
	z.object({
		projectId: z.string().uuid(),
		strategyId: z.string().uuid(),
	}),
	async ({ projectId, strategyId }) => {
		const user = requireAuthenticatedRequestUser()
		return submitStrategy({ projectId, strategyId, userId: user.id })
	},
)

export const approveStrategyCommand = command(
	z.object({
		projectId: z.string().uuid(),
		strategyId: z.string().uuid(),
	}),
	async ({ projectId, strategyId }) => {
		const user = requireAuthenticatedRequestUser()
		return approveStrategy({
			projectId,
			strategyId,
			userId: user.id,
			approverUserId: user.id,
		})
	},
)

export const rejectStrategyCommand = command(
	z.object({
		projectId: z.string().uuid(),
		strategyId: z.string().uuid(),
		rejectionReason: z.string().trim().min(1).max(4000),
	}),
	async ({ projectId, strategyId, rejectionReason }) => {
		const user = requireAuthenticatedRequestUser()
		return rejectStrategy({
			projectId,
			strategyId,
			userId: user.id,
			rejectionReason,
		})
	},
)

export const getActiveProjectForRequest = query(async () => {
	const user = requireAuthenticatedRequestUser()
	const event = getRequestEvent()
	const requestedProjectId = event.url.searchParams.get('projectId')

	if (requestedProjectId) {
		return getProjectForUser(requestedProjectId, user.id)
	}

	const [first] = await listProjectsForUser(user.id, { includeArchived: false })
	return first ?? null
})

import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'
import { db } from '$lib/db.server'
import { emitActivity } from '$lib/activity/activity.server'
import { projectGoals, projects, projectStrategies } from '$lib/projects/projects.schema'

type ProjectStatus = 'active' | 'archived' | 'deleted'
type GoalStatus = 'planned' | 'active' | 'blocked' | 'completed' | 'archived'
type StrategyStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'active' | 'superseded'

export async function createProjectForUser(input: { ownerUserId: string; name: string; description?: string | null }) {
	const [project] = await db
		.insert(projects)
		.values({
			ownerUserId: input.ownerUserId,
			name: input.name,
			description: input.description ?? null,
		})
		.returning()

	const [goal] = await db
		.insert(projectGoals)
		.values({
			projectId: project.id,
			title: 'Primary goal',
			description: 'Define and track your main objective for this project.',
			status: 'planned',
			priority: 2,
			path: '',
		})
		.returning()

	void emitActivity('project_created', `Project created: ${project.name}`, {
		entityId: project.id,
		entityType: 'project',
		metadata: { ownerUserId: input.ownerUserId },
	})
	void emitActivity('goal_created', `Goal created: ${goal.title}`, {
		entityId: goal.id,
		entityType: 'project_goal',
		metadata: { projectId: project.id },
	})

	return { ...project, seedGoalId: goal.id }
}

export async function listProjectsForUser(userId: string, options?: { includeArchived?: boolean }) {
	const conditions = [eq(projects.ownerUserId, userId), ne(projects.status, 'deleted')]
	if (!options?.includeArchived) {
		conditions.push(eq(projects.status, 'active'))
	}

	return db
		.select()
		.from(projects)
		.where(and(...conditions))
		.orderBy(desc(projects.updatedAt), asc(projects.name))
}

export async function getProjectForUser(projectId: string, userId: string) {
	const [project] = await db
		.select()
		.from(projects)
		.where(and(eq(projects.id, projectId), eq(projects.ownerUserId, userId), ne(projects.status, 'deleted')))
		.limit(1)

	return project ?? null
}

export async function updateProjectStatusForUser(input: { projectId: string; userId: string; status: ProjectStatus }) {
	const [project] = await db
		.update(projects)
		.set({ status: input.status, updatedAt: new Date() })
		.where(and(eq(projects.id, input.projectId), eq(projects.ownerUserId, input.userId)))
		.returning()

	if (!project) {
		throw new Error('Project not found or not accessible')
	}

	void emitActivity('project_status_changed', `Project ${project.name} set to ${input.status}`, {
		entityId: project.id,
		entityType: 'project',
		metadata: { status: input.status },
	})

	return project
}

export async function createGoalForProject(input: {
	projectId: string
	userId: string
	title: string
	description?: string | null
	parentGoalId?: string
	priority?: number
}) {
	const project = await getProjectForUser(input.projectId, input.userId)
	if (!project) {
		throw new Error('Project not found or not accessible')
	}

	let path = ''
	if (input.parentGoalId) {
		const [parentGoal] = await db
			.select()
			.from(projectGoals)
			.where(and(eq(projectGoals.id, input.parentGoalId), eq(projectGoals.projectId, input.projectId)))
			.limit(1)
		if (!parentGoal) {
			throw new Error('Parent goal not found in this project')
		}
		path = parentGoal.path ? `${parentGoal.path}/${parentGoal.id}` : parentGoal.id
	}

	const [goal] = await db
		.insert(projectGoals)
		.values({
			projectId: input.projectId,
			parentGoalId: input.parentGoalId ?? null,
			title: input.title,
			description: input.description ?? null,
			status: 'planned',
			priority: input.priority ?? 2,
			path,
		})
		.returning()

	void emitActivity('goal_created', `Goal created: ${goal.title}`, {
		entityId: goal.id,
		entityType: 'project_goal',
		metadata: { projectId: input.projectId, parentGoalId: input.parentGoalId ?? null },
	})

	return goal
}

export async function listGoalsForProject(input: { projectId: string; userId: string }) {
	const project = await getProjectForUser(input.projectId, input.userId)
	if (!project) {
		throw new Error('Project not found or not accessible')
	}

	return db
		.select()
		.from(projectGoals)
		.where(eq(projectGoals.projectId, input.projectId))
		.orderBy(asc(projectGoals.path), desc(projectGoals.priority), asc(projectGoals.createdAt))
}

export async function updateGoalStatusForProject(input: {
	goalId: string
	projectId: string
	userId: string
	status: GoalStatus
}) {
	const project = await getProjectForUser(input.projectId, input.userId)
	if (!project) {
		throw new Error('Project not found or not accessible')
	}

	const [goal] = await db
		.update(projectGoals)
		.set({ status: input.status, updatedAt: new Date() })
		.where(and(eq(projectGoals.id, input.goalId), eq(projectGoals.projectId, input.projectId)))
		.returning()

	if (!goal) {
		throw new Error('Goal not found in this project')
	}

	return goal
}

export async function createDraftStrategy(input: {
	projectId: string
	goalId?: string
	userId: string
	title: string
	summary: string
	details?: string
	proposedByAgentName?: string
}) {
	const project = await getProjectForUser(input.projectId, input.userId)
	if (!project) {
		throw new Error('Project not found or not accessible')
	}

	if (input.goalId) {
		const [goal] = await db
			.select({ id: projectGoals.id })
			.from(projectGoals)
			.where(and(eq(projectGoals.id, input.goalId), eq(projectGoals.projectId, input.projectId)))
			.limit(1)
		if (!goal) {
			throw new Error('Goal not found in this project')
		}
	}

	const [strategy] = await db
		.insert(projectStrategies)
		.values({
			projectId: input.projectId,
			goalId: input.goalId ?? null,
			title: input.title,
			summary: input.summary,
			details: input.details ?? null,
			proposedByAgentName: input.proposedByAgentName ?? null,
			status: 'draft',
		})
		.returning()

	return strategy
}

export async function submitStrategy(input: { strategyId: string; projectId: string; userId: string }) {
	const project = await getProjectForUser(input.projectId, input.userId)
	if (!project) {
		throw new Error('Project not found or not accessible')
	}

	const [strategy] = await db
		.update(projectStrategies)
		.set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date(), rejectionReason: null })
		.where(and(eq(projectStrategies.id, input.strategyId), eq(projectStrategies.projectId, input.projectId)))
		.returning()

	if (!strategy) {
		throw new Error('Strategy not found in this project')
	}

	void emitActivity('strategy_submitted', `Strategy submitted: ${strategy.title}`, {
		entityId: strategy.id,
		entityType: 'project_strategy',
		metadata: { projectId: input.projectId, goalId: strategy.goalId },
	})

	return strategy
}

export async function approveStrategy(input: {
	strategyId: string
	projectId: string
	userId: string
	approverUserId: string
}) {
	const project = await getProjectForUser(input.projectId, input.userId)
	if (!project) {
		throw new Error('Project not found or not accessible')
	}

	const [candidate] = await db
		.select({ id: projectStrategies.id, status: projectStrategies.status })
		.from(projectStrategies)
		.where(and(eq(projectStrategies.id, input.strategyId), eq(projectStrategies.projectId, input.projectId)))
		.limit(1)
	if (!candidate) {
		throw new Error('Strategy not found in this project')
	}
	if (candidate.status !== 'submitted') {
		throw new Error('Only submitted strategies can be approved')
	}

	// Keep one active strategy per project in V1.
	await db
		.update(projectStrategies)
		.set({ status: 'superseded', updatedAt: new Date() })
		.where(and(eq(projectStrategies.projectId, input.projectId), eq(projectStrategies.status, 'active')))

	const [strategy] = await db
		.update(projectStrategies)
		.set({
			status: 'active',
			approvedAt: new Date(),
			approvedByUserId: input.approverUserId,
			updatedAt: new Date(),
			rejectionReason: null,
		})
		.where(and(eq(projectStrategies.id, input.strategyId), eq(projectStrategies.projectId, input.projectId)))
		.returning()

	void emitActivity('strategy_approved', `Strategy approved: ${strategy.title}`, {
		entityId: strategy.id,
		entityType: 'project_strategy',
		metadata: { projectId: input.projectId, approverUserId: input.approverUserId },
	})

	return strategy
}

export async function rejectStrategy(input: {
	strategyId: string
	projectId: string
	userId: string
	rejectionReason: string
}) {
	const project = await getProjectForUser(input.projectId, input.userId)
	if (!project) {
		throw new Error('Project not found or not accessible')
	}

	const [strategy] = await db
		.update(projectStrategies)
		.set({
			status: 'rejected',
			rejectionReason: input.rejectionReason,
			updatedAt: new Date(),
		})
		.where(and(eq(projectStrategies.id, input.strategyId), eq(projectStrategies.projectId, input.projectId)))
		.returning()

	if (!strategy) {
		throw new Error('Strategy not found in this project')
	}

	void emitActivity('strategy_rejected', `Strategy rejected: ${strategy.title}`, {
		entityId: strategy.id,
		entityType: 'project_strategy',
		metadata: { projectId: input.projectId },
	})

	return strategy
}

export async function listStrategiesForProject(input: {
	projectId: string
	userId: string
	statuses?: StrategyStatus[]
}) {
	const project = await getProjectForUser(input.projectId, input.userId)
	if (!project) {
		throw new Error('Project not found or not accessible')
	}

	const conditions = [eq(projectStrategies.projectId, input.projectId)]
	if (input.statuses && input.statuses.length > 0) {
		conditions.push(inArray(projectStrategies.status, input.statuses))
	}

	return db
		.select()
		.from(projectStrategies)
		.where(and(...conditions))
		.orderBy(desc(projectStrategies.updatedAt), desc(projectStrategies.createdAt))
}

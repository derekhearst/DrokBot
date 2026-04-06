import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '$lib/auth/auth.schema'

export const projectStatusEnum = pgEnum('project_status', ['active', 'archived', 'deleted'])
export const projectGoalStatusEnum = pgEnum('project_goal_status', [
	'planned',
	'active',
	'blocked',
	'completed',
	'archived',
])
export const strategyStatusEnum = pgEnum('strategy_status', [
	'draft',
	'submitted',
	'approved',
	'rejected',
	'active',
	'superseded',
])

export const projects = pgTable(
	'projects',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ownerUserId: uuid('owner_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		status: projectStatusEnum('status').notNull().default('active'),
		settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index('projects_owner_user_id_idx').on(t.ownerUserId)],
)

export const projectGoals = pgTable(
	'project_goals',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		parentGoalId: uuid('parent_goal_id'),
		title: text('title').notNull(),
		description: text('description'),
		status: projectGoalStatusEnum('status').notNull().default('planned'),
		priority: integer('priority').notNull().default(2),
		path: text('path').notNull().default(''),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		index('project_goals_project_id_idx').on(t.projectId),
		index('project_goals_parent_goal_id_idx').on(t.parentGoalId),
		index('project_goals_status_idx').on(t.status),
	],
)

export const projectStrategies = pgTable(
	'project_strategies',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		goalId: uuid('goal_id').references(() => projectGoals.id, { onDelete: 'set null' }),
		title: text('title').notNull(),
		summary: text('summary').notNull(),
		details: text('details'),
		proposedByAgentName: text('proposed_by_agent_name'),
		status: strategyStatusEnum('status').notNull().default('draft'),
		submittedAt: timestamp('submitted_at', { withTimezone: true }),
		approvedAt: timestamp('approved_at', { withTimezone: true }),
		approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
		rejectionReason: text('rejection_reason'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		index('project_strategies_project_id_idx').on(t.projectId),
		index('project_strategies_goal_id_idx').on(t.goalId),
		index('project_strategies_status_idx').on(t.status),
	],
)

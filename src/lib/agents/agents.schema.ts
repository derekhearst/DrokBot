import { integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { messageRoleEnum } from '../chat/chat.schema'

export const agentStatusEnum = pgEnum('agent_status', ['active', 'paused', 'idle'])
export const taskStatusEnum = pgEnum('task_status', [
	'pending',
	'running',
	'completed',
	'failed',
	'review',
	'changes_requested',
])
export const reviewTypeEnum = pgEnum('review_type', ['heavy', 'quick', 'informational'])

export const agents = pgTable('agents', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	role: text('role').notNull(),
	systemPrompt: text('system_prompt').notNull(),
	model: text('model').notNull().default('anthropic/claude-sonnet-4'),
	config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
	status: agentStatusEnum('status').notNull().default('idle'),
	parentAgentId: uuid('parent_agent_id'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const agentTasks = pgTable('agent_tasks', {
	id: uuid('id').primaryKey().defaultRandom(),
	agentId: uuid('agent_id')
		.notNull()
		.references(() => agents.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description').notNull(),
	status: taskStatusEnum('status').notNull().default('pending'),
	priority: integer('priority').notNull().default(2),
	result: jsonb('result').$type<Record<string, unknown>>().notNull().default({}),
	gitBranch: text('git_branch'),
	reviewType: reviewTypeEnum('review_type'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	completedAt: timestamp('completed_at', { withTimezone: true }),
})

export const agentRuns = pgTable('agent_runs', {
	id: uuid('id').primaryKey().defaultRandom(),
	agentId: uuid('agent_id')
		.notNull()
		.references(() => agents.id, { onDelete: 'cascade' }),
	taskId: uuid('task_id').references(() => agentTasks.id, { onDelete: 'set null' }),
	startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
	endedAt: timestamp('ended_at', { withTimezone: true }),
	tokenUsage: jsonb('token_usage').$type<Record<string, unknown>>().notNull().default({}),
	cost: numeric('cost', { precision: 12, scale: 6 }).notNull().default('0'),
	logs: jsonb('logs').$type<Array<Record<string, unknown>>>().notNull().default([]),
})

export const taskComments = pgTable('task_comments', {
	id: uuid('id').primaryKey().defaultRandom(),
	taskId: uuid('task_id')
		.notNull()
		.references(() => agentTasks.id, { onDelete: 'cascade' }),
	role: messageRoleEnum('role').notNull().default('user'),
	content: text('content').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const taskMessages = pgTable('task_messages', {
	id: uuid('id').primaryKey().defaultRandom(),
	taskId: uuid('task_id')
		.notNull()
		.references(() => agentTasks.id, { onDelete: 'cascade' }),
	role: messageRoleEnum('role').notNull(),
	content: text('content').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

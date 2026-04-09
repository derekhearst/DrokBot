import { index, integer, jsonb, numeric, pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../auth/auth.schema'
import { agents } from '../agents/agents.schema'

export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system', 'tool'])
export const chatRunStateEnum = pgEnum('chat_run_state', [
	'queued',
	'running',
	'waiting_tool_approval',
	'waiting_user_input',
	'waiting_plan_decision',
	'completed',
	'failed',
	'canceled',
])
export const chatRunSourceEnum = pgEnum('chat_run_source', ['chat_stream', 'agent_subagent', 'automation'])

export const conversations = pgTable('conversations', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: text('title').notNull(),
	category: text('category'),
	userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
	agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
	model: text('model').notNull().default('anthropic/claude-sonnet-4'),
	totalTokens: integer('total_tokens').notNull().default(0),
	totalCost: numeric('total_cost', { precision: 18, scale: 12 }).notNull().default('0'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const messages = pgTable('messages', {
	id: uuid('id').primaryKey().defaultRandom(),
	conversationId: uuid('conversation_id')
		.notNull()
		.references(() => conversations.id, { onDelete: 'cascade' }),
	role: messageRoleEnum('role').notNull(),
	content: text('content').notNull(),
	metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
	toolCalls: jsonb('tool_calls').$type<Array<Record<string, unknown>>>().notNull().default([]),
	attachments: jsonb('attachments')
		.$type<Array<{ id: string; filename: string; mimeType: string; size: number; url: string }>>()
		.notNull()
		.default([]),
	model: text('model'),
	tokensIn: integer('tokens_in').notNull().default(0),
	tokensOut: integer('tokens_out').notNull().default(0),
	cost: numeric('cost', { precision: 18, scale: 12 }).notNull().default('0'),
	ttftMs: integer('ttft_ms'),
	totalMs: integer('total_ms'),
	tokensPerSec: real('tokens_per_sec'),
	parentMessageId: uuid('parent_message_id'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const chatRuns = pgTable(
	'chat_runs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
		state: chatRunStateEnum('state').notNull().default('queued'),
		source: chatRunSourceEnum('source').notNull().default('chat_stream'),
		label: text('label'),
		error: text('error'),
		lastDelta: text('last_delta'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }),
		lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		conversationIdx: index('chat_runs_conversation_idx').on(table.conversationId),
		userIdx: index('chat_runs_user_idx').on(table.userId),
		agentIdx: index('chat_runs_agent_idx').on(table.agentId),
		stateIdx: index('chat_runs_state_idx').on(table.state),
		updatedIdx: index('chat_runs_updated_idx').on(table.updatedAt),
	}),
)

import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const activityEventTypeEnum = pgEnum('activity_event_type', [
	'task_created',
	'task_status_changed',
	'agent_action',
	'memory_created',
	'dream_cycle',
	'chat_started',
	'review_action',
])

export const activityEvents = pgTable('activity_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	type: activityEventTypeEnum('type').notNull(),
	entityId: text('entity_id'),
	entityType: text('entity_type'),
	summary: text('summary').notNull(),
	metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

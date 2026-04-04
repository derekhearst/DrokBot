import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../auth/auth.schema'

export const appSettings = pgTable('app_settings', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
	defaultModel: text('default_model').notNull().default('anthropic/claude-sonnet-4'),
	notificationPrefs: jsonb('notification_prefs')
		.$type<{
			taskCompleted: boolean
			needsInput: boolean
			dreamSummary: boolean
			agentErrors: boolean
		}>()
		.notNull()
		.default({ taskCompleted: true, needsInput: true, dreamSummary: true, agentErrors: true }),
	dreamConfig: jsonb('dream_config')
		.$type<{
			autoRun: boolean
			frequencyHours: number
			aggressiveness: number
		}>()
		.notNull()
		.default({ autoRun: false, frequencyHours: 24, aggressiveness: 0.5 }),
	budgetConfig: jsonb('budget_config')
		.$type<{
			dailyLimit: number | null
			monthlyLimit: number | null
		}>()
		.notNull()
		.default({ dailyLimit: null, monthlyLimit: null }),
	theme: text('theme').notNull().default('drokbot'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

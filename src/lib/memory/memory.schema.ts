import { integer, pgEnum, pgTable, real, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core'

export const memoryRelationTypeEnum = pgEnum('memory_relation_type', [
	'supports',
	'contradicts',
	'depends_on',
	'part_of',
])

export const memories = pgTable('memories', {
	id: uuid('id').primaryKey().defaultRandom(),
	content: text('content').notNull(),
	category: text('category').notNull().default('general'),
	importance: real('importance').notNull().default(0.5),
	embedding: vector('embedding', { dimensions: 1536 }),
	accessCount: integer('access_count').notNull().default(0),
	lastAccessed: timestamp('last_accessed', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	decayedAt: timestamp('decayed_at', { withTimezone: true }),
})

export const memoryRelations = pgTable('memory_relations', {
	id: uuid('id').primaryKey().defaultRandom(),
	sourceMemoryId: uuid('source_memory_id')
		.notNull()
		.references(() => memories.id, { onDelete: 'cascade' }),
	targetMemoryId: uuid('target_memory_id')
		.notNull()
		.references(() => memories.id, { onDelete: 'cascade' }),
	relationType: memoryRelationTypeEnum('relation_type').notNull(),
	strength: real('strength').notNull().default(0.5),
})

export const dreamCycles = pgTable('dream_cycles', {
	id: uuid('id').primaryKey().defaultRandom(),
	startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
	endedAt: timestamp('ended_at', { withTimezone: true }),
	memoriesProcessed: integer('memories_processed').notNull().default(0),
	memoriesCreated: integer('memories_created').notNull().default(0),
	memoriesPruned: integer('memories_pruned').notNull().default(0),
	summary: text('summary'),
})

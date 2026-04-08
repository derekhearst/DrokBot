CREATE TYPE "public"."activity_event_type" AS ENUM(
	'task_created',
	'task_status_changed',
	'agent_action',
	'memory_created',
	'dream_cycle',
	'chat_started',
	'review_action',
	'skill_created'
);
--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('active', 'paused', 'idle');
--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('heavy', 'quick', 'informational');
--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM(
	'pending',
	'running',
	'completed',
	'failed',
	'review',
	'changes_requested'
);
--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM(
	'markdown',
	'code',
	'config',
	'image',
	'svg',
	'mermaid',
	'html',
	'svelte',
	'data_table',
	'chart',
	'audio',
	'video'
);
--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system', 'tool');
--> statement-breakpoint
CREATE TYPE "public"."memory_relation_type" AS ENUM(
	'supports',
	'contradicts',
	'depends_on',
	'part_of'
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "activity_event_type" NOT NULL,
	"entity_id" text,
	"entity_type" text,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"task_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"token_usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost" numeric(18, 12) DEFAULT '0' NOT NULL,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"git_branch" text,
	"review_type" "review_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"system_prompt" text NOT NULL,
	"model" text DEFAULT 'anthropic/claude-sonnet-4' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "agent_status" DEFAULT 'idle' NOT NULL,
	"parent_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"role" "message_role" DEFAULT 'user' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"language" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "artifact_type" NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"language" text,
	"mime_type" text,
	"url" text,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"storage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conversation_id" uuid,
	"message_id" uuid,
	"task_id" uuid,
	"pinned" boolean DEFAULT false NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"user_id" uuid,
	"model" text DEFAULT 'anthropic/claude-sonnet-4' NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost" numeric(18, 12) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost" numeric(18, 12) DEFAULT '0' NOT NULL,
	"ttft_ms" integer,
	"total_ms" integer,
	"tokens_per_sec" real,
	"parent_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"model" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost" numeric(18, 12) DEFAULT '0' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dream_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"memories_processed" integer DEFAULT 0 NOT NULL,
	"memories_created" integer DEFAULT 0 NOT NULL,
	"memories_pruned" integer DEFAULT 0 NOT NULL,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"importance" real DEFAULT 0.5 NOT NULL,
	"embedding" vector(1536),
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decayed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memory_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_memory_id" uuid NOT NULL,
	"target_memory_id" uuid NOT NULL,
	"relation_type" "memory_relation_type" NOT NULL,
	"strength" real DEFAULT 0.5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"device_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"default_model" text DEFAULT 'anthropic/claude-sonnet-4' NOT NULL,
	"notification_prefs" jsonb DEFAULT '{"taskCompleted":true,"needsInput":true,"dreamSummary":true,"agentErrors":true}'::jsonb NOT NULL,
	"dream_config" jsonb DEFAULT '{"autoRun":false,"frequencyHours":24,"aggressiveness":0.5}'::jsonb NOT NULL,
	"budget_config" jsonb DEFAULT '{"dailyLimit":null,"monthlyLimit":null}'::jsonb NOT NULL,
	"context_config" jsonb DEFAULT '{"reservedResponsePct":30,"autoCompactThresholdPct":72}'::jsonb NOT NULL,
	"tool_config" jsonb DEFAULT '{"approvalMode":"auto"}'::jsonb NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"theme" text DEFAULT 'AgentStudio-night' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_files_skill_id_name_unique" UNIQUE("skill_id", "name")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"tags" text [] DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "agent_runs"
ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_runs"
ADD CONSTRAINT "agent_runs_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE
set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_tasks"
ADD CONSTRAINT "agent_tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_comments"
ADD CONSTRAINT "task_comments_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_messages"
ADD CONSTRAINT "task_messages_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artifact_versions"
ADD CONSTRAINT "artifact_versions_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artifacts"
ADD CONSTRAINT "artifacts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE
set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artifacts"
ADD CONSTRAINT "artifacts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE
set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "artifacts"
ADD CONSTRAINT "artifacts_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE
set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE
set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messages"
ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "memory_relations"
ADD CONSTRAINT "memory_relations_source_memory_id_memories_id_fk" FOREIGN KEY ("source_memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "memory_relations"
ADD CONSTRAINT "memory_relations_target_memory_id_memories_id_fk" FOREIGN KEY ("target_memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "push_subscriptions"
ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_settings"
ADD CONSTRAINT "app_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "skill_files"
ADD CONSTRAINT "skill_files_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
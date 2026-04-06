CREATE TYPE "public"."project_goal_status" AS ENUM('planned', 'active', 'blocked', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."strategy_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'active', 'superseded');--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE 'project_created';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE 'project_status_changed';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE 'goal_created';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE 'strategy_submitted';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE 'strategy_approved';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE 'strategy_rejected';--> statement-breakpoint
CREATE TABLE "project_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_goal_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "project_goal_status" DEFAULT 'planned' NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"goal_id" uuid,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"proposed_by_agent_name" text,
	"status" "strategy_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_strategies" ADD CONSTRAINT "project_strategies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_strategies" ADD CONSTRAINT "project_strategies_goal_id_project_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."project_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_strategies" ADD CONSTRAINT "project_strategies_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_goals_project_id_idx" ON "project_goals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_goals_parent_goal_id_idx" ON "project_goals" USING btree ("parent_goal_id");--> statement-breakpoint
CREATE INDEX "project_goals_status_idx" ON "project_goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_strategies_project_id_idx" ON "project_strategies" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_strategies_goal_id_idx" ON "project_strategies" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "project_strategies_status_idx" ON "project_strategies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_owner_user_id_idx" ON "projects" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE IF EXISTS "project_goals" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "project_strategies" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "projects" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP TABLE IF EXISTS "project_goals" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "project_strategies" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "projects" CASCADE;
--> statement-breakpoint
ALTER TABLE IF EXISTS "agent_runs" DROP CONSTRAINT IF EXISTS "agent_runs_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE IF EXISTS "agent_tasks" DROP CONSTRAINT IF EXISTS "agent_tasks_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE IF EXISTS "agents" DROP CONSTRAINT IF EXISTS "agents_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE IF EXISTS "artifacts" DROP CONSTRAINT IF EXISTS "artifacts_task_id_agent_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "agent_id" uuid;
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (
	SELECT 1
	FROM pg_constraint
	WHERE conname = 'conversations_agent_id_agents_id_fk'
) THEN
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE
set null ON UPDATE no action;
END IF;
END $$;
--> statement-breakpoint
ALTER TABLE IF EXISTS "agent_runs" DROP COLUMN IF EXISTS "project_id";
--> statement-breakpoint
ALTER TABLE IF EXISTS "agent_tasks" DROP COLUMN IF EXISTS "project_id";
--> statement-breakpoint
ALTER TABLE IF EXISTS "agents" DROP COLUMN IF EXISTS "project_id";
--> statement-breakpoint
ALTER TABLE IF EXISTS "artifacts" DROP COLUMN IF EXISTS "task_id";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."project_goal_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."project_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."strategy_status";
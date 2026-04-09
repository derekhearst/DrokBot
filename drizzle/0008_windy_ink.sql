CREATE TYPE "public"."chat_run_source" AS ENUM('chat_stream', 'agent_subagent', 'automation');--> statement-breakpoint
CREATE TYPE "public"."chat_run_state" AS ENUM('queued', 'running', 'waiting_tool_approval', 'waiting_user_input', 'waiting_plan_decision', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "chat_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid,
	"agent_id" uuid,
	"state" "chat_run_state" DEFAULT 'queued' NOT NULL,
	"source" "chat_run_source" DEFAULT 'chat_stream' NOT NULL,
	"label" text,
	"error" text,
	"last_delta" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_runs_conversation_idx" ON "chat_runs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_runs_user_idx" ON "chat_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_runs_agent_idx" ON "chat_runs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "chat_runs_state_idx" ON "chat_runs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "chat_runs_updated_idx" ON "chat_runs" USING btree ("updated_at");
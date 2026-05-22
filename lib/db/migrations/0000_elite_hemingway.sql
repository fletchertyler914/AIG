CREATE TYPE "public"."intent_status" AS ENUM('DRAFT', 'UNCERTAIN', 'FORMED', 'PENDING_REVIEW', 'MODIFIED', 'REGENERATING', 'APPROVED', 'EXECUTING', 'COMPLETE', 'PARTIAL_FAILURE', 'FAILED', 'BLOCKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."mutation_actor" AS ENUM('agent', 'human', 'system');--> statement-breakpoint
CREATE TYPE "public"."mutation_type" AS ENUM('agent_proposed', 'agent_regenerated', 'system_invalidated', 'system_expired', 'human_removed', 'human_edited', 'human_approved', 'human_blocked', 'arcade_executed', 'arcade_failed');--> statement-breakpoint
CREATE TYPE "public"."rollback_policy" AS ENUM('HALT_REMAINING', 'COMPENSATE');--> statement-breakpoint
CREATE TYPE "public"."tool_call_status" AS ENUM('pending', 'approved', 'executing', 'done', 'failed', 'invalidated');--> statement-breakpoint
CREATE TABLE "execution_records" (
	"id" text PRIMARY KEY NOT NULL,
	"intent_id" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"result" jsonb,
	"error" text,
	"success" boolean NOT NULL,
	"ts" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intents" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"objective" text NOT NULL,
	"objective_locked" boolean DEFAULT true NOT NULL,
	"status" "intent_status" DEFAULT 'DRAFT' NOT NULL,
	"window_id" text NOT NULL,
	"systems" text[] DEFAULT '{}'::text[] NOT NULL,
	"impact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" numeric(3, 2),
	"approved_by" text,
	"approved_at" bigint,
	"expire_at" bigint NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mutations" (
	"id" text PRIMARY KEY NOT NULL,
	"intent_id" text NOT NULL,
	"mutation_index" integer NOT NULL,
	"type" "mutation_type" NOT NULL,
	"actor" "mutation_actor" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ts" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"intent_id" text NOT NULL,
	"tool" text NOT NULL,
	"args" jsonb NOT NULL,
	"arg_snapshot" jsonb,
	"status" "tool_call_status" DEFAULT 'pending' NOT NULL,
	"depends_on" text[] DEFAULT '{}'::text[] NOT NULL,
	"rollback_policy" "rollback_policy" DEFAULT 'HALT_REMAINING' NOT NULL,
	"rollback_args" jsonb,
	"exec_result" jsonb,
	"exec_error" text,
	"locked" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "execution_records" ADD CONSTRAINT "execution_records_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_records" ADD CONSTRAINT "execution_records_tool_call_id_tool_calls_id_fk" FOREIGN KEY ("tool_call_id") REFERENCES "public"."tool_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutations" ADD CONSTRAINT "mutations_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exec_intent_idx" ON "execution_records" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "intents_status_idx" ON "intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "intents_window_idx" ON "intents" USING btree ("window_id");--> statement-breakpoint
CREATE INDEX "intents_created_at_idx" ON "intents" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mutations_intent_index_uq" ON "mutations" USING btree ("intent_id","mutation_index");--> statement-breakpoint
CREATE INDEX "mutations_intent_idx" ON "mutations" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "tool_calls_intent_idx" ON "tool_calls" USING btree ("intent_id");
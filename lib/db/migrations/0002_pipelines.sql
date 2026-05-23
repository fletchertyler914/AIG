CREATE TABLE "pipelines" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_intent_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"objective" text NOT NULL,
	"systems" text[] DEFAULT '{}'::text[] NOT NULL,
	"template" jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_source_intent_id_intents_id_fk" FOREIGN KEY ("source_intent_id") REFERENCES "public"."intents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "pipelines_workspace_name_version_uq" ON "pipelines" USING btree ("workspace_id","name","version");
--> statement-breakpoint
CREATE INDEX "pipelines_workspace_idx" ON "pipelines" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "pipelines_source_intent_idx" ON "pipelines" USING btree ("source_intent_id");

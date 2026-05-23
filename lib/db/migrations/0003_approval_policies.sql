CREATE TYPE "public"."approval_policy_action" AS ENUM('require_admin_approval', 'block');
--> statement-breakpoint
CREATE TABLE "approval_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_policy_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_id" text NOT NULL,
	"tool_pattern" text NOT NULL,
	"action" "approval_policy_action" NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "approval_policy_rules" ADD CONSTRAINT "approval_policy_rules_policy_id_approval_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."approval_policies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "approval_policies_workspace_name_uq" ON "approval_policies" USING btree ("workspace_id","name");
--> statement-breakpoint
CREATE INDEX "approval_policies_workspace_idx" ON "approval_policies" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "approval_policy_rules_policy_idx" ON "approval_policy_rules" USING btree ("policy_id");
--> statement-breakpoint
CREATE INDEX "approval_policy_rules_pattern_idx" ON "approval_policy_rules" USING btree ("tool_pattern");

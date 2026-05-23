CREATE TYPE "public"."policy_decision_outcome" AS ENUM('allowed', 'blocked');
--> statement-breakpoint
CREATE TABLE "policy_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"intent_id" text NOT NULL,
	"approver_user_id" text,
	"approver_email" text,
	"approver_role" text,
	"decision" "policy_decision_outcome" NOT NULL,
	"reason" text,
	"matched_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_approver_user_id_user_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "policy_decisions_workspace_created_idx" ON "policy_decisions" USING btree ("workspace_id","created_at");
--> statement-breakpoint
CREATE INDEX "policy_decisions_workspace_decision_idx" ON "policy_decisions" USING btree ("workspace_id","decision");
--> statement-breakpoint
CREATE INDEX "policy_decisions_intent_idx" ON "policy_decisions" USING btree ("intent_id");
--> statement-breakpoint
CREATE INDEX "policy_decisions_approver_idx" ON "policy_decisions" USING btree ("approver_user_id");

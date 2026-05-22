CREATE TYPE "public"."connection_scope" AS ENUM('personal', 'shared');--> statement-breakpoint
ALTER TABLE "toolkit_connections" ADD COLUMN "scope" "connection_scope" DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "toolkit_connections" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "toolkit_connections" ADD COLUMN "arcade_user_id" text;--> statement-breakpoint
ALTER TABLE "toolkit_connections" ADD COLUMN "pending_flow_id" text;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "approved_by_user_id" text;--> statement-breakpoint
UPDATE "toolkit_connections" tc
SET
  "owner_user_id" = u."id",
  "arcade_user_id" = 'user:' || u."id"
FROM "user" u
WHERE tc."connected_user_id" IS NOT NULL
  AND u."email" = tc."connected_user_id";--> statement-breakpoint
UPDATE "toolkit_connections"
SET
  "scope" = 'shared',
  "owner_user_id" = NULL,
  "arcade_user_id" = 'workspace:' || "workspace_id"
WHERE "connected_user_id" IS NOT NULL
  AND "owner_user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "toolkit_connections" DROP COLUMN IF EXISTS "connected_user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "toolkit_connections_workspace_toolkit_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "toolkit_connections_personal_uq" ON "toolkit_connections" USING btree ("workspace_id","toolkit_name","owner_user_id") WHERE "scope" = 'personal';--> statement-breakpoint
CREATE UNIQUE INDEX "toolkit_connections_shared_uq" ON "toolkit_connections" USING btree ("workspace_id","toolkit_name") WHERE "scope" = 'shared';--> statement-breakpoint
CREATE INDEX "toolkit_connections_pending_flow_idx" ON "toolkit_connections" USING btree ("pending_flow_id");--> statement-breakpoint
ALTER TABLE "toolkit_connections" ADD CONSTRAINT "toolkit_connections_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intents" ADD CONSTRAINT "intents_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

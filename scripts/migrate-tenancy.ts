/**
 * One-time tenancy migration:
 *   1. Ensure default org + production workspace exist
 *   2. Backfill workspace_id on all intents missing it
 *
 * Run after `pnpm db:push` when adding workspace_id as nullable, or as a
 * pre-step before making the column NOT NULL.
 *
 *   pnpm tsx scripts/migrate-tenancy.ts
 */

import { isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { intents } from '@/lib/db/schema'
import { ensureDefaultWorkspace } from '@/lib/db/workspace-queries'

async function main() {
  const workspace = await ensureDefaultWorkspace()
  console.log(`default workspace: ${workspace.id} (org ${workspace.organizationId})`)

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(intents)
    .where(isNull(intents.workspaceId))

  if (count === 0) {
    console.log('no intents to backfill')
    return
  }

  await db.update(intents).set({ workspaceId: workspace.id }).where(isNull(intents.workspaceId))

  console.log(`backfilled ${count} intent(s) → workspace ${workspace.slug}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

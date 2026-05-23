/**
 * Workspace insights — read-only aggregates for the control plane dashboard.
 */

import { count, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { countPipelinesForWorkspace } from '@/lib/db/pipeline-queries'
import { intents, toolkitConnections } from '@/lib/db/schema'

export interface WorkspaceInsights {
  intentsByStatus: Record<string, number>
  totalIntents: number
  pipelineCount: number
  connectedToolkits: number
  enabledToolkits: number
  recentIntentIds: string[]
}

export async function getWorkspaceInsights(workspaceId: string): Promise<WorkspaceInsights> {
  const [statusRows, pipelineCount, connectionStats, recent] = await Promise.all([
    db
      .select({ status: intents.status, count: count() })
      .from(intents)
      .where(eq(intents.workspaceId, workspaceId))
      .groupBy(intents.status),
    countPipelinesForWorkspace(workspaceId),
    db
      .select({
        connected: sql<number>`count(*) filter (where ${toolkitConnections.authStatus} = 'completed')::int`,
        enabled: sql<number>`count(*) filter (where ${toolkitConnections.enabled})::int`,
      })
      .from(toolkitConnections)
      .where(eq(toolkitConnections.workspaceId, workspaceId)),
    db
      .select({ id: intents.id })
      .from(intents)
      .where(eq(intents.workspaceId, workspaceId))
      .orderBy(sql`${intents.createdAt} desc`)
      .limit(5),
  ])

  const intentsByStatus: Record<string, number> = {}
  let totalIntents = 0
  for (const row of statusRows) {
    intentsByStatus[row.status] = row.count
    totalIntents += row.count
  }

  const stats = connectionStats[0]

  return {
    intentsByStatus,
    totalIntents,
    pipelineCount,
    connectedToolkits: stats?.connected ?? 0,
    enabledToolkits: stats?.enabled ?? 0,
    recentIntentIds: recent.map((r) => r.id),
  }
}

import { jsonError, jsonOk, messageFromUnknown } from '@/lib/api/http'
import { resolveWorkspaceContext } from '@/lib/auth/session'
import { getWorkspaceInsights } from '@/lib/db/insights-queries'
import { listRecentIntents } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const ctx = await resolveWorkspaceContext()
    const [insights, recentIntents] = await Promise.all([
      getWorkspaceInsights(ctx.workspace.id),
      listRecentIntents({ workspaceId: ctx.workspace.id, limit: 8 }),
    ])

    return jsonOk({
      workspace: { id: ctx.workspace.id, name: ctx.workspace.name, kind: ctx.workspace.kind },
      insights,
      recentIntents: recentIntents.map((intent) => ({
        id: intent.id,
        label: intent.label,
        status: intent.status,
        createdAt: intent.createdAt,
        systems: intent.systems,
      })),
    })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

import { expireIfNeeded } from '@/lib/aig/expire'
import { jsonError, jsonOk } from '@/lib/api/http'
import { getIntentWithTrace } from '@/lib/db/queries'
import { syncAuthorizationIfNeeded } from '@/lib/intent/authorization-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  let snapshot = await getIntentWithTrace(id)
  if (!snapshot) return jsonError('Intent not found', 404)

  await syncAuthorizationIfNeeded(id)
  snapshot = await getIntentWithTrace(id)
  if (!snapshot) return jsonError('Intent not found', 404)

  const newStatus = await expireIfNeeded(snapshot.intent)
  if (newStatus !== snapshot.intent.status) {
    snapshot = await getIntentWithTrace(id)
    if (!snapshot) return jsonError('Intent not found', 404)
  }

  return jsonOk(snapshot)
}

import { jsonError, jsonOk } from '@/lib/api/http'
import { getIntentWithTrace } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const intent = await getIntentWithTrace(id)
  if (!intent) return jsonError('Intent not found', 404)
  return jsonOk(intent)
}

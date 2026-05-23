import { jsonError, jsonOk, messageFromUnknown } from '@/lib/api/http'
import { personalArcadeIdentity, toArcadeUserId } from '@/lib/arcade/identity'
import { getArcadeToolDetail } from '@/lib/arcade/tool-index'
import { resolveWorkspaceContext } from '@/lib/auth/session'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

interface RouteContext {
  params: Promise<{ name: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { name } = await context.params
    const toolName = decodeURIComponent(name)
    const ctx = await resolveWorkspaceContext()
    const identity = personalArcadeIdentity(
      ctx.userId === 'anonymous' ? 'demo' : ctx.userId,
      ctx.email || env.DEMO_USER_ID,
    )
    const tool = await getArcadeToolDetail({
      arcadeUserId: toArcadeUserId(identity),
      toolName,
      signal: request.signal,
    })

    if (!tool) return jsonError(`Unknown Arcade tool: ${toolName}`, 404)

    return jsonOk({ tool })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

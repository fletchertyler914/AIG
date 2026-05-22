import { z } from 'zod'
import { executeApprovedIntent } from '@/lib/aig/executor'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { requireSession, resolveWorkspaceContext } from '@/lib/auth/session'
import { appendMutation, getIntentWithTrace, markIntentApproved } from '@/lib/db/queries'
import { isE2eAuthSkipped } from '@/lib/env'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

const approveSchema = z.object({
  execute: z.boolean().default(false),
})

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const body = parseJson(approveSchema, await request.json())

    let approvedBy: string
    let approvedByUserId: string | null

    if (isE2eAuthSkipped) {
      const ctx = await resolveWorkspaceContext()
      approvedBy = ctx.email || 'e2e-operator'
      approvedByUserId = null
    } else {
      const session = await requireSession()
      approvedBy = session.user.email
      approvedByUserId = session.user.id
    }

    const approved = await markIntentApproved(id, approvedBy, approvedByUserId)
    if (!approved) return jsonError('Intent not found', 404)

    await appendMutation({
      intentId: id,
      type: 'human_approved',
      actor: 'human',
      payload: {
        approvedBy,
        approvedByUserId,
        execute: body.execute,
      },
    })

    if (body.execute) {
      const result = await executeApprovedIntent({
        intentId: id,
        approvedByUserId: approvedByUserId ?? 'e2e-anonymous',
      })
      return jsonOk({ ...(await getIntentWithTrace(id)), execution: result })
    }

    return jsonOk(await getIntentWithTrace(id))
  } catch (error) {
    logger.error({ err: error, intentId: id }, 'failed to approve intent')
    return jsonError(messageFromUnknown(error), 400)
  }
}

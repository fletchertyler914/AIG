import { z } from 'zod'
import { executeApprovedIntent } from '@/lib/aig/executor'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { appendMutation, getIntentWithTrace, markIntentApproved } from '@/lib/db/queries'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

const approveSchema = z.object({
  approvedBy: z.string().email(),
  execute: z.boolean().default(false),
})

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const body = parseJson(approveSchema, await request.json())
    const approved = await markIntentApproved(id, body.approvedBy)
    if (!approved) return jsonError('Intent not found', 404)

    await appendMutation({
      intentId: id,
      type: 'human_approved',
      actor: 'human',
      payload: {
        approvedBy: body.approvedBy,
        execute: body.execute,
      },
    })

    if (body.execute) {
      const result = await executeApprovedIntent({
        intentId: id,
        arcadeUserId: body.approvedBy,
      })
      return jsonOk({ ...(await getIntentWithTrace(id)), execution: result })
    }

    return jsonOk(await getIntentWithTrace(id))
  } catch (error) {
    logger.error({ err: error, intentId: id }, 'failed to approve intent')
    return jsonError(messageFromUnknown(error), 400)
  }
}

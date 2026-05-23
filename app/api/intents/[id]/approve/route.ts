import { z } from 'zod'
import { evaluateApprovalPolicies } from '@/lib/aig/approval-policy'
import { executeApprovedIntent } from '@/lib/aig/executor'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { requireSession, resolveWorkspaceContext } from '@/lib/auth/session'
import { listApprovalPoliciesForWorkspace } from '@/lib/db/approval-policy-queries'
import { recordPolicyDecision } from '@/lib/db/audit-queries'
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
    const ctx = await resolveWorkspaceContext()

    if (isE2eAuthSkipped) {
      approvedBy = ctx.email || 'e2e-operator'
      approvedByUserId = null
    } else {
      const session = await requireSession()
      approvedBy = session.user.email
      approvedByUserId = session.user.id
    }

    const trace = await getIntentWithTrace(id)
    if (!trace || trace.intent.workspaceId !== ctx.workspace.id) {
      return jsonError('Intent not found', 404)
    }

    const policies = await listApprovalPoliciesForWorkspace(ctx.workspace.id)
    const policyDecision = evaluateApprovalPolicies({
      policies,
      toolCalls: trace.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        tool: toolCall.tool,
      })),
      approverRole: ctx.memberRole,
    })
    if (!policyDecision.ok) {
      if (policyDecision.matchedRules.length > 0) {
        await recordPolicyDecision({
          workspaceId: ctx.workspace.id,
          intentId: id,
          approverUserId: approvedByUserId,
          approverEmail: approvedBy,
          approverRole: ctx.memberRole,
          decision: 'blocked',
          reason: policyDecision.error ?? 'Approval blocked by workspace policy',
          matchedRules: policyDecision.matchedRules,
        })
      }
      return jsonError(policyDecision.error ?? 'Approval blocked by workspace policy', 403)
    }

    const approved = await markIntentApproved(id, approvedBy, approvedByUserId)
    if (!approved) return jsonError('Intent not found', 404)

    if (policyDecision.matchedRules.length > 0) {
      await recordPolicyDecision({
        workspaceId: ctx.workspace.id,
        intentId: id,
        approverUserId: approvedByUserId,
        approverEmail: approvedBy,
        approverRole: ctx.memberRole,
        decision: 'allowed',
        reason: null,
        matchedRules: policyDecision.matchedRules,
      })
    }

    await appendMutation({
      intentId: id,
      type: 'human_approved',
      actor: 'human',
      payload: {
        approvedBy,
        approvedByUserId,
        execute: body.execute,
        policiesMatched: policyDecision.matchedRules,
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

import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { canManageSharedConnections, resolveWorkspaceContext } from '@/lib/auth/session'
import { deleteApprovalPolicy, setApprovalPolicyEnabled } from '@/lib/db/approval-policy-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

const patchPolicySchema = z.object({
  enabled: z.boolean(),
})

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = parseJson(patchPolicySchema, await request.json())
    const { id } = await context.params
    const ctx = await resolveWorkspaceContext()

    if (!canManageSharedConnections(ctx.memberRole)) {
      return jsonError('Only workspace owners and admins can manage approval policies', 403)
    }

    const policy = await setApprovalPolicyEnabled({
      workspaceId: ctx.workspace.id,
      policyId: id,
      enabled: body.enabled,
    })
    if (!policy) return jsonError('Approval policy not found', 404)

    return jsonOk({ policy })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const ctx = await resolveWorkspaceContext()

    if (!canManageSharedConnections(ctx.memberRole)) {
      return jsonError('Only workspace owners and admins can manage approval policies', 403)
    }

    const deleted = await deleteApprovalPolicy({
      workspaceId: ctx.workspace.id,
      policyId: id,
    })
    if (!deleted) return jsonError('Approval policy not found', 404)

    return jsonOk({ deleted: true })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

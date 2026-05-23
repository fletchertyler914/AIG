import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { canManageSharedConnections, resolveWorkspaceContext } from '@/lib/auth/session'
import {
  createApprovalPolicy,
  listApprovalPoliciesForWorkspace,
} from '@/lib/db/approval-policy-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ruleSchema = z.object({
  toolPattern: z.string().trim().min(1).max(160),
  action: z.enum(['require_admin_approval', 'block']),
})

const createPolicySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean().default(true),
  rules: z.array(ruleSchema).min(1).max(10),
})

export interface ApprovalPolicyDto {
  id: string
  name: string
  description: string | null
  enabled: boolean
  createdAt: number
  updatedAt: number
  rules: Array<{
    id: string
    toolPattern: string
    action: 'require_admin_approval' | 'block'
  }>
}

export interface ApprovalPoliciesResponseDto {
  canManage: boolean
  policies: ApprovalPolicyDto[]
}

export async function GET() {
  try {
    const ctx = await resolveWorkspaceContext()
    const policies = await listApprovalPoliciesForWorkspace(ctx.workspace.id)
    return jsonOk({
      canManage: canManageSharedConnections(ctx.memberRole),
      policies: policies.map(toDto),
    } satisfies ApprovalPoliciesResponseDto)
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

export async function POST(request: Request) {
  try {
    const body = parseJson(createPolicySchema, await request.json())
    const ctx = await resolveWorkspaceContext()

    if (!canManageSharedConnections(ctx.memberRole)) {
      return jsonError('Only workspace owners and admins can manage approval policies', 403)
    }

    const policy = await createApprovalPolicy({
      workspaceId: ctx.workspace.id,
      name: body.name,
      description: body.description ?? null,
      enabled: body.enabled,
      createdByUserId: ctx.userId === 'anonymous' ? null : ctx.userId,
      rules: body.rules,
    })

    return jsonOk({ policy: toDto(policy) }, { status: 201 })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

function toDto(row: {
  id: string
  name: string
  description: string | null
  enabled: boolean
  createdAt: number
  updatedAt: number
  rules: Array<{
    id: string
    toolPattern: string
    action: 'require_admin_approval' | 'block'
  }>
}): ApprovalPolicyDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    rules: row.rules.map((rule) => ({
      id: rule.id,
      toolPattern: rule.toolPattern,
      action: rule.action,
    })),
  }
}

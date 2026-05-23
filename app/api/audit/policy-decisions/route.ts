import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown } from '@/lib/api/http'
import { resolveWorkspaceContext } from '@/lib/auth/session'
import { listPolicyDecisionAudit, type PolicyDecisionAuditRow } from '@/lib/db/audit-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const auditQuerySchema = z.object({
  decision: z.enum(['allowed', 'blocked']).optional(),
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
  policyId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  tool: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  format: z.enum(['json', 'csv']).default('json'),
})

export async function GET(request: Request) {
  try {
    const ctx = await resolveWorkspaceContext()
    const params = Object.fromEntries(new URL(request.url).searchParams)
    const query = auditQuerySchema.parse(params)
    const filters = {
      workspaceId: ctx.workspace.id,
      limit: query.limit,
    }
    const rows = await listPolicyDecisionAudit({
      ...filters,
      ...(query.decision ? { decision: query.decision } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.policyId ? { policyId: query.policyId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.tool ? { tool: query.tool } : {}),
      ...(query.actor ? { actor: query.actor } : {}),
    })

    if (query.format === 'csv') {
      return new Response(toCsv(rows), {
        headers: {
          'Content-Disposition': 'attachment; filename="policy-decisions.csv"',
          'Content-Type': 'text/csv; charset=utf-8',
        },
      })
    }

    return jsonOk({ decisions: rows })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

function toCsv(rows: PolicyDecisionAuditRow[]): string {
  const header = [
    'created_at',
    'decision',
    'intent_id',
    'intent_label',
    'approver_email',
    'approver_role',
    'policies',
    'tools',
    'reason',
  ]
  const lines = rows.map((row) =>
    [
      new Date(row.createdAt).toISOString(),
      row.decision,
      row.intentId,
      row.intentLabel,
      row.approverEmail ?? '',
      row.approverRole ?? '',
      row.matchedRules.map((rule) => rule.policyName).join('; '),
      row.matchedRules.map((rule) => rule.tool).join('; '),
      row.reason ?? '',
    ]
      .map(csvCell)
      .join(','),
  )

  return [header.join(','), ...lines].join('\n')
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

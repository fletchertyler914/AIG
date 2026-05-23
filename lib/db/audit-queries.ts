import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { db } from '@/lib/db/client'
import {
  intents,
  type NewPolicyDecision,
  type PolicyDecisionOutcome,
  policyDecisions,
} from '@/lib/db/schema'

export interface PolicyDecisionMatchedRule {
  policyId: string
  policyName: string
  ruleId: string
  toolPattern: string
  action: string
  tool: string
  toolCallId: string
}

export interface PolicyDecisionAuditRow {
  id: string
  workspaceId: string
  intentId: string
  intentLabel: string
  intentStatus: string
  approverUserId: string | null
  approverEmail: string | null
  approverRole: string | null
  decision: PolicyDecisionOutcome
  reason: string | null
  matchedRules: PolicyDecisionMatchedRule[]
  createdAt: number
}

export interface PolicyDecisionAuditFilters {
  workspaceId: string
  decision?: PolicyDecisionOutcome
  from?: number
  to?: number
  policyId?: string
  action?: string
  tool?: string
  actor?: string
  limit?: number
}

export async function recordPolicyDecision(input: {
  workspaceId: string
  intentId: string
  approverUserId: string | null
  approverEmail: string | null
  approverRole: string | null
  decision: PolicyDecisionOutcome
  reason?: string | null
  matchedRules: PolicyDecisionMatchedRule[]
}): Promise<void> {
  await db.insert(policyDecisions).values({
    id: ulid(),
    workspaceId: input.workspaceId,
    intentId: input.intentId,
    approverUserId: input.approverUserId,
    approverEmail: input.approverEmail,
    approverRole: input.approverRole,
    decision: input.decision,
    reason: input.reason ?? null,
    matchedRules: input.matchedRules,
    createdAt: Date.now(),
  } satisfies NewPolicyDecision)
}

export async function listPolicyDecisionAudit(
  filters: PolicyDecisionAuditFilters,
): Promise<PolicyDecisionAuditRow[]> {
  const queryLimit = Math.min(Math.max(filters.limit ?? 50, 1), 100)
  const dbLimit = Math.min(queryLimit * 5, 500)
  const conditions = [
    eq(policyDecisions.workspaceId, filters.workspaceId),
    filters.decision ? eq(policyDecisions.decision, filters.decision) : undefined,
    filters.from ? gte(policyDecisions.createdAt, filters.from) : undefined,
    filters.to ? lte(policyDecisions.createdAt, filters.to) : undefined,
    filters.actor ? sql`${policyDecisions.approverEmail} ilike ${`%${filters.actor}%`}` : undefined,
  ].filter((condition) => condition !== undefined)

  const rows = await db
    .select({
      id: policyDecisions.id,
      workspaceId: policyDecisions.workspaceId,
      intentId: policyDecisions.intentId,
      intentLabel: intents.label,
      intentStatus: intents.status,
      approverUserId: policyDecisions.approverUserId,
      approverEmail: policyDecisions.approverEmail,
      approverRole: policyDecisions.approverRole,
      decision: policyDecisions.decision,
      reason: policyDecisions.reason,
      matchedRules: policyDecisions.matchedRules,
      createdAt: policyDecisions.createdAt,
    })
    .from(policyDecisions)
    .innerJoin(intents, eq(intents.id, policyDecisions.intentId))
    .where(and(...conditions))
    .orderBy(desc(policyDecisions.createdAt))
    .limit(dbLimit)

  return rows
    .map((row) => ({
      ...row,
      matchedRules: parseMatchedRules(row.matchedRules),
    }))
    .filter((row) => matchesPolicyDecisionFilters(row, filters))
    .slice(0, queryLimit)
}

function parseMatchedRules(value: unknown): PolicyDecisionMatchedRule[] {
  if (!Array.isArray(value)) return []
  return value.filter(isMatchedRule)
}

function isMatchedRule(value: unknown): value is PolicyDecisionMatchedRule {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate['policyId'] === 'string' &&
    typeof candidate['policyName'] === 'string' &&
    typeof candidate['ruleId'] === 'string' &&
    typeof candidate['toolPattern'] === 'string' &&
    typeof candidate['action'] === 'string' &&
    typeof candidate['tool'] === 'string' &&
    typeof candidate['toolCallId'] === 'string'
  )
}

function matchesPolicyDecisionFilters(
  row: PolicyDecisionAuditRow,
  filters: PolicyDecisionAuditFilters,
): boolean {
  if (!filters.policyId && !filters.action && !filters.tool) return true

  return row.matchedRules.some((rule) => {
    if (filters.policyId && rule.policyId !== filters.policyId) return false
    if (filters.action && rule.action !== filters.action) return false
    if (filters.tool && !rule.tool.toLowerCase().includes(filters.tool.toLowerCase())) {
      return false
    }
    return true
  })
}

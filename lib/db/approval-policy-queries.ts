import { asc, eq, inArray, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { db } from '@/lib/db/client'
import {
  type ApprovalPolicy,
  type ApprovalPolicyRule,
  approvalPolicies,
  approvalPolicyRules,
  type NewApprovalPolicyRule,
} from '@/lib/db/schema'

export interface ApprovalPolicyWithRules extends ApprovalPolicy {
  rules: ApprovalPolicyRule[]
}

export async function listApprovalPoliciesForWorkspace(
  workspaceId: string,
): Promise<ApprovalPolicyWithRules[]> {
  const policies = await db
    .select()
    .from(approvalPolicies)
    .where(eq(approvalPolicies.workspaceId, workspaceId))
    .orderBy(asc(approvalPolicies.name), asc(approvalPolicies.createdAt))

  if (policies.length === 0) return []

  const rules = await db
    .select()
    .from(approvalPolicyRules)
    .where(
      inArray(
        approvalPolicyRules.policyId,
        policies.map((policy) => policy.id),
      ),
    )
    .orderBy(asc(approvalPolicyRules.createdAt))

  const rulesByPolicy = new Map<string, ApprovalPolicyRule[]>()
  for (const rule of rules) {
    const existing = rulesByPolicy.get(rule.policyId)
    if (existing) {
      existing.push(rule)
    } else {
      rulesByPolicy.set(rule.policyId, [rule])
    }
  }

  return policies.map((policy) => ({
    ...policy,
    rules: rulesByPolicy.get(policy.id) ?? [],
  }))
}

export async function createApprovalPolicy(input: {
  workspaceId: string
  name: string
  description?: string | null
  enabled?: boolean
  createdByUserId?: string | null
  rules: Array<{
    toolPattern: string
    action: NewApprovalPolicyRule['action']
  }>
}): Promise<ApprovalPolicyWithRules> {
  return db.transaction(async (tx) => {
    const policyId = ulid()
    const now = Date.now()
    const [policy] = await tx
      .insert(approvalPolicies)
      .values({
        id: policyId,
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description ?? null,
        enabled: input.enabled ?? true,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!policy) throw new Error('failed to create approval policy')

    const rules = await tx
      .insert(approvalPolicyRules)
      .values(
        input.rules.map((rule) => ({
          id: ulid(),
          policyId,
          toolPattern: rule.toolPattern,
          action: rule.action,
          createdAt: now,
        })),
      )
      .returning()

    return { ...policy, rules }
  })
}

export async function setApprovalPolicyEnabled(input: {
  workspaceId: string
  policyId: string
  enabled: boolean
}): Promise<ApprovalPolicy | null> {
  const [updated] = await db
    .update(approvalPolicies)
    .set({ enabled: input.enabled, updatedAt: Date.now() })
    .where(
      sql`${approvalPolicies.id} = ${input.policyId} and ${approvalPolicies.workspaceId} = ${input.workspaceId}`,
    )
    .returning()
  return updated ?? null
}

export async function deleteApprovalPolicy(input: {
  workspaceId: string
  policyId: string
}): Promise<boolean> {
  const deleted = await db
    .delete(approvalPolicies)
    .where(
      sql`${approvalPolicies.id} = ${input.policyId} and ${approvalPolicies.workspaceId} = ${input.workspaceId}`,
    )
    .returning({ id: approvalPolicies.id })
  return deleted.length > 0
}

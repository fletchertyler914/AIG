/**
 * Approval policy evaluation — pure domain, no DB or framework imports.
 */

export type ApprovalPolicyAction = 'require_admin_approval' | 'block'

export interface ApprovalPolicyRuleInput {
  id: string
  toolPattern: string
  action: ApprovalPolicyAction
}

export interface ApprovalPolicyInput {
  id: string
  name: string
  enabled: boolean
  rules: ApprovalPolicyRuleInput[]
}

export interface ApprovalToolCallInput {
  id: string
  tool: string
}

export interface ApprovalPolicyDecision {
  ok: boolean
  matchedRules: Array<{
    policyId: string
    policyName: string
    ruleId: string
    toolPattern: string
    action: ApprovalPolicyAction
    tool: string
    toolCallId: string
  }>
  error?: string
}

export function canApproveRestrictedIntent(role: string | null): boolean {
  return role === 'owner' || role === 'admin'
}

export function evaluateApprovalPolicies(input: {
  policies: ApprovalPolicyInput[]
  toolCalls: ApprovalToolCallInput[]
  approverRole: string | null
}): ApprovalPolicyDecision {
  const matchedRules: ApprovalPolicyDecision['matchedRules'] = []

  for (const policy of input.policies) {
    if (!policy.enabled) continue
    for (const rule of policy.rules) {
      const matchingToolCall = input.toolCalls.find((toolCall) =>
        toolPatternMatches(rule.toolPattern, toolCall.tool),
      )
      if (!matchingToolCall) continue
      matchedRules.push({
        policyId: policy.id,
        policyName: policy.name,
        ruleId: rule.id,
        toolPattern: rule.toolPattern,
        action: rule.action,
        tool: matchingToolCall.tool,
        toolCallId: matchingToolCall.id,
      })
    }
  }

  const blocked = matchedRules.find((rule) => rule.action === 'block')
  if (blocked) {
    return {
      ok: false,
      matchedRules,
      error: `Approval blocked by policy "${blocked.policyName}" for ${blocked.tool}.`,
    }
  }

  const restricted = matchedRules.find((rule) => rule.action === 'require_admin_approval')
  if (restricted && !canApproveRestrictedIntent(input.approverRole)) {
    return {
      ok: false,
      matchedRules,
      error: `Policy "${restricted.policyName}" requires an owner or admin to approve ${restricted.tool}.`,
    }
  }

  return { ok: true, matchedRules }
}

export function toolPatternMatches(pattern: string, toolName: string): boolean {
  const normalizedPattern = pattern.trim()
  if (!normalizedPattern) return false
  if (normalizedPattern === '*') return true

  const escaped = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
  return new RegExp(`^${escaped}$`, 'i').test(toolName)
}

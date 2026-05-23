import { describe, expect, it } from 'vitest'
import {
  canApproveRestrictedIntent,
  evaluateApprovalPolicies,
  toolPatternMatches,
} from '@/lib/aig/approval-policy'

describe('toolPatternMatches', () => {
  it('matches wildcard tool patterns case-insensitively', () => {
    expect(toolPatternMatches('Gmail.*', 'Gmail.SendEmail@1')).toBe(true)
    expect(toolPatternMatches('gmail.send*', 'Gmail.SendEmail@1')).toBe(true)
    expect(toolPatternMatches('Slack.*', 'Gmail.SendEmail@1')).toBe(false)
  })
})

describe('canApproveRestrictedIntent', () => {
  it('allows owners and admins', () => {
    expect(canApproveRestrictedIntent('owner')).toBe(true)
    expect(canApproveRestrictedIntent('admin')).toBe(true)
    expect(canApproveRestrictedIntent('member')).toBe(false)
  })
})

describe('evaluateApprovalPolicies', () => {
  const toolCalls = [
    {
      id: 'tc-1',
      tool: 'Gmail.SendEmail@1',
    },
  ]

  it('requires owner/admin for restricted matching policies', () => {
    const decision = evaluateApprovalPolicies({
      approverRole: 'member',
      toolCalls,
      policies: [
        {
          id: 'policy-1',
          name: 'Sensitive sends',
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              toolPattern: 'Gmail.*',
              action: 'require_admin_approval',
            },
          ],
        },
      ],
    })

    expect(decision.ok).toBe(false)
    expect(decision.error).toContain('requires an owner or admin')
  })

  it('allows owner/admin through restricted matching policies', () => {
    const decision = evaluateApprovalPolicies({
      approverRole: 'admin',
      toolCalls,
      policies: [
        {
          id: 'policy-1',
          name: 'Sensitive sends',
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              toolPattern: 'Gmail.*',
              action: 'require_admin_approval',
            },
          ],
        },
      ],
    })

    expect(decision.ok).toBe(true)
    expect(decision.matchedRules).toHaveLength(1)
  })

  it('blocks matching policies for every role', () => {
    const decision = evaluateApprovalPolicies({
      approverRole: 'owner',
      toolCalls,
      policies: [
        {
          id: 'policy-1',
          name: 'No email',
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              toolPattern: 'Gmail.*',
              action: 'block',
            },
          ],
        },
      ],
    })

    expect(decision.ok).toBe(false)
    expect(decision.error).toContain('blocked')
  })
})

import { describe, expect, it } from 'vitest'
import { validateConnectionForExecution } from '@/lib/aig/connection-auth'
import { AIGBlockedAuthError } from '@/lib/aig/types'

const completedPersonal = {
  scope: 'personal' as const,
  authStatus: 'completed',
  arcadeUserId: 'user:alice',
  ownerUserId: 'alice',
}

const completedShared = {
  scope: 'shared' as const,
  authStatus: 'completed',
  arcadeUserId: 'workspace:ws1',
  ownerUserId: null,
}

describe('validateConnectionForExecution', () => {
  it('allows personal connection when approver owns it', () => {
    expect(
      validateConnectionForExecution({
        connection: completedPersonal,
        approverUserId: 'alice',
        isWorkspaceMember: true,
        toolkitName: 'Gmail',
      }).arcadeUserId,
    ).toBe('user:alice')
  })

  it('blocks personal connection for a different approver', () => {
    expect(() =>
      validateConnectionForExecution({
        connection: completedPersonal,
        approverUserId: 'bob',
        isWorkspaceMember: true,
        toolkitName: 'Gmail',
      }),
    ).toThrow(AIGBlockedAuthError)
  })

  it('allows shared connection for any workspace member', () => {
    expect(
      validateConnectionForExecution({
        connection: completedShared,
        approverUserId: 'bob',
        isWorkspaceMember: true,
        toolkitName: 'Slack',
      }).arcadeUserId,
    ).toBe('workspace:ws1')
  })

  it('blocks shared connection for non-members', () => {
    expect(() =>
      validateConnectionForExecution({
        connection: completedShared,
        approverUserId: 'bob',
        isWorkspaceMember: false,
        toolkitName: 'Slack',
      }),
    ).toThrow(AIGBlockedAuthError)
  })

  it('returns null connection as blocked auth', () => {
    expect(() =>
      validateConnectionForExecution({
        connection: null,
        approverUserId: 'alice',
        isWorkspaceMember: true,
        toolkitName: 'Gmail',
      }),
    ).toThrow(AIGBlockedAuthError)
  })
})

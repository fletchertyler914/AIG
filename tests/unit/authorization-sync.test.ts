import { describe, expect, it } from 'vitest'
import type { IntentWithTrace } from '@/lib/db/queries'
import { intentSnapshotFingerprint } from '@/lib/intent/authorization-sync'

function snapshot(overrides: Partial<IntentWithTrace['intent']> = {}): IntentWithTrace {
  return {
    intent: {
      id: 'intent-1',
      workspaceId: 'ws-1',
      createdByUserId: 'user-1',
      label: 'Test',
      description: 'Test',
      objective: 'Test objective',
      objectiveLocked: true,
      status: 'UNCERTAIN',
      windowId: 'win-1',
      systems: ['Gmail'],
      impact: { pendingAuthorizations: [{ tool: 'Gmail.SendEmail@7.0.0', status: 'pending' }] },
      confidence: '0.85',
      approvedByUserId: null,
      approvedBy: null,
      approvedAt: null,
      expireAt: Date.now() + 60_000,
      createdAt: Date.now(),
      ...overrides,
    },
    toolCalls: [
      {
        id: 'tc-1',
        intentId: 'intent-1',
        tool: 'Gmail.SendEmail@7.0.0',
        args: { subject: 'Hi' },
        argSnapshot: null,
        status: 'pending',
        dependsOn: [],
        rollbackPolicy: 'HALT_REMAINING',
        rollbackArgs: null,
        execResult: null,
        execError: null,
        locked: false,
        position: 0,
        createdAt: Date.now(),
      },
    ],
    mutations: [],
  }
}

describe('intentSnapshotFingerprint', () => {
  it('changes when pending authorizations change', () => {
    const before = snapshot()
    const after = snapshot({
      impact: {},
      status: 'PENDING_REVIEW',
    })
    expect(intentSnapshotFingerprint(before)).not.toBe(intentSnapshotFingerprint(after))
  })

  it('changes when tool call args change', () => {
    const base = snapshot({ status: 'PENDING_REVIEW', impact: {} })
    const first = base.toolCalls[0]
    if (!first) throw new Error('expected tool call fixture')
    const edited = {
      ...base,
      toolCalls: [{ ...first, args: { subject: 'Updated' } }],
    }
    expect(intentSnapshotFingerprint(base)).not.toBe(intentSnapshotFingerprint(edited))
  })
})

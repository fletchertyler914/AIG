import { afterEach, describe, expect, it, vi } from 'vitest'

import { expireIfNeeded } from '@/lib/aig/expire'
import * as queries from '@/lib/db/queries'
import type { Intent } from '@/lib/db/schema'

function makeIntent(status: Intent['status'], expireAt: number): Intent {
  return {
    id: 'int_test',
    label: 'test',
    description: 'test',
    objective: 'test',
    objectiveLocked: true,
    windowId: 'win_test',
    status,
    confidence: 0.9,
    proposedBy: 'agent',
    approvedBy: null,
    systems: ['Gmail'],
    impact: {},
    proposedAt: Date.now(),
    expireAt,
  } as unknown as Intent
}

describe('expireIfNeeded', () => {
  const setIntentStatus = vi.spyOn(queries, 'setIntentStatus')
  const appendMutation = vi.spyOn(queries, 'appendMutation')

  afterEach(() => {
    setIntentStatus.mockReset()
    appendMutation.mockReset()
  })

  it('no-ops when intent has not expired yet', async () => {
    setIntentStatus.mockResolvedValue(null)
    appendMutation.mockResolvedValue({} as never)

    const result = await expireIfNeeded(makeIntent('PENDING_REVIEW', Date.now() + 60_000))

    expect(result).toBe('PENDING_REVIEW')
    expect(setIntentStatus).not.toHaveBeenCalled()
    expect(appendMutation).not.toHaveBeenCalled()
  })

  it('transitions PENDING_REVIEW → EXPIRED past deadline', async () => {
    setIntentStatus.mockResolvedValue(null)
    appendMutation.mockResolvedValue({} as never)

    const result = await expireIfNeeded(makeIntent('PENDING_REVIEW', Date.now() - 1_000))

    expect(result).toBe('EXPIRED')
    expect(setIntentStatus).toHaveBeenCalledWith('int_test', 'EXPIRED')
    expect(appendMutation).toHaveBeenCalledWith(
      expect.objectContaining({ intentId: 'int_test', type: 'system_expired', actor: 'system' }),
    )
  })

  it('does not expire a terminal intent', async () => {
    const result = await expireIfNeeded(makeIntent('COMPLETE', Date.now() - 1_000))
    expect(result).toBe('COMPLETE')
    expect(setIntentStatus).not.toHaveBeenCalled()
  })

  it('refuses to expire non-PENDING_REVIEW states (state-machine integrity)', async () => {
    for (const status of ['UNCERTAIN', 'MODIFIED', 'REGENERATING', 'DRAFT'] as const) {
      const result = await expireIfNeeded(makeIntent(status, Date.now() - 1_000))
      expect(result).toBe(status)
    }
    expect(setIntentStatus).not.toHaveBeenCalled()
  })
})

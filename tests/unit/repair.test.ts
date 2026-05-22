import { describe, expect, it } from 'vitest'
import { assertRepairContract, repairIntent } from '@/lib/aig/repair'
import { AIGRepairContractError, type RepairInput } from '@/lib/aig/types'

const baseInput: RepairInput = {
  objective: 'Test objective',
  objectiveLocked: true,
  lockedNodes: [
    {
      id: 'locked-1',
      tool: 'Google.SendEmail',
      args: { to: 'a@b.co' },
      locked: true,
      humanEdited: false,
      dependsOn: [],
    },
  ],
  invalidatedNodes: [
    {
      id: 'inv-1',
      tool: 'Google.CreateEvent',
      args: {},
      locked: false,
      humanEdited: false,
      dependsOn: ['locked-1'],
    },
  ],
  preservedNodes: [],
}

describe('assertRepairContract', () => {
  it('passes when locked preserved and invalidated removed', () => {
    expect(() =>
      assertRepairContract(baseInput, {
        replace: [],
        preserve: ['locked-1'],
        remove: ['inv-1'],
      }),
    ).not.toThrow()
  })

  it('throws when locked node missing from preserve', () => {
    expect(() =>
      assertRepairContract(baseInput, {
        replace: [],
        preserve: [],
        remove: ['inv-1'],
      }),
    ).toThrow(AIGRepairContractError)
  })
})

describe('repairIntent mock path', () => {
  it('returns mock without calling the model', async () => {
    const response = await repairIntent(baseInput, {
      mockResponse: { replace: [], preserve: ['locked-1'], remove: ['inv-1'] },
    })
    expect(response.preserve).toContain('locked-1')
  })
})

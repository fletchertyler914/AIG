import { describe, expect, it } from 'vitest'
import { buildE2eRepairResponse } from '@/lib/aig/e2e-repair'
import type { RepairInput } from '@/lib/aig/types'

describe('buildE2eRepairResponse', () => {
  it('preserves non-invalidated nodes and removes invalidated ones', () => {
    const input: RepairInput = {
      objective: 'Demo objective',
      objectiveLocked: true,
      lockedNodes: [],
      invalidatedNodes: [
        {
          id: 'tc-cal',
          tool: 'GoogleCalendar.CreateEvent',
          args: {},
          locked: false,
          humanEdited: false,
          dependsOn: ['tc-mail'],
        },
      ],
      preservedNodes: [
        {
          id: 'tc-mail',
          tool: 'Gmail.SendEmail',
          args: {},
          locked: false,
          humanEdited: false,
          dependsOn: [],
        },
      ],
    }

    const response = buildE2eRepairResponse(input)
    expect(response.replace).toEqual([])
    expect(response.preserve).toEqual(['tc-mail'])
    expect(response.remove).toEqual(['tc-cal'])
  })
})

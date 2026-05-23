import { describe, expect, it } from 'vitest'
import {
  buildPipelineTemplate,
  buildSeedPipelineTemplate,
  canPromoteIntentStatus,
} from '@/lib/aig/pipeline'
import {
  intentStatusDisplay,
  readPendingAuthCount,
  uncertainReasonFor,
} from '@/lib/display/intent-status'

describe('intentStatusDisplay', () => {
  it('shows AUTH REQUIRED when OAuth is pending', () => {
    const display = intentStatusDisplay({
      status: 'UNCERTAIN',
      confidence: '0.95',
      pendingAuthCount: 1,
    })
    expect(display.label).toBe('AUTH REQUIRED')
    expect(display.uncertainReason).toBe('auth_pending')
  })

  it('shows LOW CONFIDENCE when grouping confidence is below gate', () => {
    const display = intentStatusDisplay({
      status: 'UNCERTAIN',
      confidence: '0.4',
      pendingAuthCount: 0,
    })
    expect(display.label).toBe('LOW CONFIDENCE')
    expect(display.uncertainReason).toBe('low_confidence')
  })

  it('passes through PENDING_REVIEW unchanged', () => {
    const display = intentStatusDisplay({
      status: 'PENDING_REVIEW',
      confidence: '0.9',
      pendingAuthCount: 0,
    })
    expect(display.label).toBe('PENDING REVIEW')
  })
})

describe('uncertainReasonFor', () => {
  it('detects both gates active', () => {
    expect(uncertainReasonFor({ confidence: '0.3', pendingAuthCount: 2 })).toBe('both')
  })
})

describe('readPendingAuthCount', () => {
  it('counts pendingAuthorizations in impact', () => {
    expect(readPendingAuthCount({ pendingAuthorizations: [{ tool: 'Gmail.SendEmail@1' }] })).toBe(1)
  })
})

describe('buildPipelineTemplate', () => {
  it('maps ULID dependsOn to positional refs', () => {
    const template = buildPipelineTemplate({
      label: 'Test',
      description: 'Desc',
      objective: 'Do the thing',
      systems: ['Gmail'],
      confidence: 0.9,
      toolCalls: [
        {
          id: 'tc-a',
          tool: 'Gmail.SendEmail@1',
          args: { to: 'a@example.com' },
          dependsOn: [],
          position: 0,
        },
        {
          id: 'tc-b',
          tool: 'GoogleCalendar.CreateEvent@1',
          args: {},
          dependsOn: ['tc-a'],
          position: 1,
        },
      ],
    })

    expect(template.toolCalls[1]?.dependsOn).toEqual(['@0'])
  })
})

describe('buildSeedPipelineTemplate', () => {
  it('creates a runnable onboarding template addressed to the operator', () => {
    const template = buildSeedPipelineTemplate('operator@example.com')

    expect(template.toolCalls).toHaveLength(3)
    expect(template.toolCalls[1]?.dependsOn).toEqual(['@0'])
    expect(template.toolCalls[2]?.args).toMatchObject({ recipient: 'operator@example.com' })
  })
})

describe('canPromoteIntentStatus', () => {
  it('allows COMPLETE and PENDING_REVIEW', () => {
    expect(canPromoteIntentStatus('COMPLETE')).toBe(true)
    expect(canPromoteIntentStatus('PENDING_REVIEW')).toBe(true)
    expect(canPromoteIntentStatus('DRAFT')).toBe(false)
  })
})

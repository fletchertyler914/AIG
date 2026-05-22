import { describe, expect, it } from 'vitest'
import {
  CONFIDENCE_GATE,
  computeConfidence,
  extractEntities,
  formCandidateIntent,
  heuristicDependencies,
  impactSummaryForCalls,
  statusForConfidence,
  systemForTool,
  systemsForCalls,
} from '@/lib/aig/formation'
import type { CapturedToolCall } from '@/lib/aig/types'

const make = (tool: string, args: Record<string, unknown>): CapturedToolCall => ({
  windowId: 'w_test',
  tool,
  args,
  capturedAt: Date.now(),
})

describe('systemForTool', () => {
  it('splits on the first dot', () => {
    expect(systemForTool('Google.SendEmail')).toBe('Google')
    expect(systemForTool('Slack.SendMessageToChannel')).toBe('Slack')
  })

  it('returns the whole string when no dot', () => {
    expect(systemForTool('CustomTool')).toBe('CustomTool')
  })
})

describe('systemsForCalls', () => {
  it('deduplicates and sorts', () => {
    expect(
      systemsForCalls([
        make('Google.SendEmail', {}),
        make('Slack.SendMessageToChannel', {}),
        make('Google.CreateEvent', {}),
      ]),
    ).toEqual(['Google', 'Slack'])
  })
})

describe('impactSummaryForCalls', () => {
  it('counts per system and total', () => {
    const summary = impactSummaryForCalls([
      make('Google.SendEmail', {}),
      make('Google.CreateEvent', {}),
      make('Slack.SendMessageToChannel', {}),
    ])
    expect(summary.totalCalls).toBe(3)
    expect(summary.bySystem).toEqual({ Google: 2, Slack: 1 })
  })
})

describe('extractEntities', () => {
  it('pulls emails out of strings', () => {
    const entities = extractEntities({
      to: 'lead@acme.com',
      cc: ['ops@acme.com', 'sam@globex.com'],
    })
    expect(entities.has('lead@acme.com')).toBe(true)
    expect(entities.has('ops@acme.com')).toBe(true)
    expect(entities.has('sam@globex.com')).toBe(true)
  })

  it('normalizes email case', () => {
    expect(extractEntities('Hi LEAD@ACME.com').has('lead@acme.com')).toBe(true)
  })

  it('pulls URLs', () => {
    const entities = extractEntities({ body: 'See https://example.com/x for details' })
    expect(Array.from(entities)).toContain('https://example.com/x')
  })

  it('walks nested arrays + objects', () => {
    const entities = extractEntities({
      recipients: [{ email: 'a@b.co' }, { email: 'c@d.co' }],
    })
    expect(entities.size).toBe(2)
  })
})

describe('heuristicDependencies', () => {
  it('links a calendar event to the email mentioning the same lead', () => {
    const deps = heuristicDependencies([
      make('Google.SendEmail', { to: 'lead@acme.com', body: 'hi' }),
      make('Google.CreateEvent', { attendees: ['lead@acme.com'], title: 'sync' }),
    ])
    expect(deps[0]?.dependsOn).toEqual([])
    expect(deps[1]?.dependsOn).toEqual(['@0'])
  })

  it('does not link calls with no entity overlap', () => {
    const deps = heuristicDependencies([
      make('Google.SendEmail', { to: 'a@x.co' }),
      make('Slack.SendMessageToChannel', { channel: 'general' }),
    ])
    expect(deps[1]?.dependsOn).toEqual([])
  })

  it('preserves positional order for fan-in', () => {
    const deps = heuristicDependencies([
      make('Google.SendEmail', { to: 'a@x.co' }),
      make('Google.SendEmail', { to: 'b@x.co' }),
      make('Slack.SendMessageToChannel', {
        channel: '#sales',
        text: 'follow ups to a@x.co and b@x.co',
      }),
    ])
    expect(deps[2]?.dependsOn).toEqual(['@0', '@1'])
  })
})

describe('computeConfidence', () => {
  it('returns 1.0 for a single call', () => {
    expect(computeConfidence([make('Google.SendEmail', {})])).toBe(1.0)
  })

  it('is above the gate when calls share entities', () => {
    const score = computeConfidence([
      make('Google.SendEmail', { to: 'lead@acme.com' }),
      make('Google.CreateEvent', { attendees: ['lead@acme.com'] }),
    ])
    expect(score).toBeGreaterThanOrEqual(CONFIDENCE_GATE)
  })

  it('drops below the gate for unrelated calls with no shared entities', () => {
    const score = computeConfidence([
      make('Google.SendEmail', { to: 'a@x.co', body: '' }),
      make('Slack.SendMessageToChannel', { channel: 'general', text: '' }),
    ])
    expect(score).toBeLessThan(CONFIDENCE_GATE)
  })

  it('is bounded in [0..1]', () => {
    const score = computeConfidence([
      make('Google.SendEmail', { to: 'lead@acme.com' }),
      make('Google.CreateEvent', { attendees: ['lead@acme.com'] }),
    ])
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})

describe('statusForConfidence', () => {
  it('PENDING_REVIEW above the gate', () => {
    expect(statusForConfidence(0.9)).toBe('PENDING_REVIEW')
    expect(statusForConfidence(CONFIDENCE_GATE)).toBe('PENDING_REVIEW')
  })
  it('UNCERTAIN below the gate', () => {
    expect(statusForConfidence(0.5)).toBe('UNCERTAIN')
    expect(statusForConfidence(0)).toBe('UNCERTAIN')
  })
})

describe('formCandidateIntent', () => {
  it('assembles a candidate with locked objective', async () => {
    const calls: CapturedToolCall[] = [
      make('Google.SendEmail', { to: 'lead@acme.com', body: 'hi' }),
      make('Google.CreateEvent', { attendees: ['lead@acme.com'], title: 'sync' }),
    ]

    const candidate = await formCandidateIntent({
      calls,
      labeler: async () => ({
        label: 'Acme follow-up',
        description: 'Email then meeting with Acme lead',
        objective: 'Coordinate Acme follow-up',
      }),
    })

    expect(candidate.label).toBe('Acme follow-up')
    expect(candidate.objective).toBe('Coordinate Acme follow-up')
    expect(candidate.systems).toEqual(['Google'])
    expect(candidate.impact.totalCalls).toBe(2)
    expect(candidate.toolCalls).toHaveLength(2)
    expect(candidate.toolCalls[1]?.dependsOn).toEqual(['@0'])
    expect(candidate.confidence).toBeGreaterThan(0)
  })

  it('respects LLM-supplied dependency refinements', async () => {
    const calls: CapturedToolCall[] = [
      make('Google.SendEmail', { to: 'a@x.co' }),
      make('Google.SendEmail', { to: 'b@x.co' }),
    ]

    const candidate = await formCandidateIntent({
      calls,
      labeler: async () => ({
        label: 'Test',
        description: 'Test',
        objective: 'Test',
        dependencies: [
          { position: 0, dependsOn: [] },
          { position: 1, dependsOn: ['@0'] },
        ],
      }),
    })

    expect(candidate.toolCalls[1]?.dependsOn).toEqual(['@0'])
  })

  it('throws on empty input', async () => {
    await expect(
      formCandidateIntent({
        calls: [],
        labeler: async () => ({ label: '', description: '', objective: '' }),
      }),
    ).rejects.toThrow(/zero tool calls/)
  })
})

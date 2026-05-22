import { describe, expect, it } from 'vitest'
import { createLlmLabeler } from '@/lib/ai/labeler'
import { formCandidateIntent } from '@/lib/aig/formation'
import type { CapturedToolCall } from '@/lib/aig/types'

const callsFixture: CapturedToolCall[] = [
  {
    windowId: 'wnd_test',
    tool: 'Gmail.SendEmail@7.0.0',
    args: { recipient: 'alice@acme.com', subject: 'Follow-up', body: '...' },
    capturedAt: 1,
  },
  {
    windowId: 'wnd_test',
    tool: 'GoogleCalendar.CreateEvent@3.3.2',
    args: {
      summary: 'Acme intro call',
      attendee_emails: ['alice@acme.com'],
      start_datetime: '2026-05-26T15:00:00-05:00',
      end_datetime: '2026-05-26T15:30:00-05:00',
    },
    capturedAt: 2,
  },
]

describe('createLlmLabeler — mock mode', () => {
  it('returns the supplied label/objective without calling the LLM', async () => {
    const labeler = createLlmLabeler({
      mockResponse: {
        label: 'Acme follow-up',
        description: 'Email Acme and schedule an intro call.',
        objective: 'Coordinate Acme lead follow-up via email + a next-step call.',
        dependencies: [
          { position: 0, dependsOn: [] },
          { position: 1, dependsOn: ['@0'] },
        ],
      },
    })

    const candidate = await formCandidateIntent({ calls: callsFixture, labeler })
    expect(candidate.label).toBe('Acme follow-up')
    expect(candidate.objective).toContain('Acme')
    expect(candidate.toolCalls[1]?.dependsOn).toEqual(['@0'])
    expect(candidate.systems).toEqual(['Gmail', 'GoogleCalendar'])
    expect(candidate.impact.totalCalls).toBe(2)
  })
})

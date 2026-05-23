/**
 * Pipeline template construction — pure domain, no I/O.
 *
 * A pipeline is a versioned snapshot of a successful run's objective + tool DAG.
 */

import type { RollbackPolicy } from './types'

export interface PipelineToolCallTemplate {
  tool: string
  args: Record<string, unknown>
  /** Positional refs (@0, @1) — resolved to ULIDs at run time. */
  dependsOn: string[]
  position: number
  rollbackPolicy?: RollbackPolicy
}

export interface PipelineTemplate {
  label: string
  description: string
  objective: string
  systems: string[]
  confidence: number | null
  toolCalls: PipelineToolCallTemplate[]
}

export interface PipelineSourceToolCall {
  id: string
  tool: string
  args: unknown
  dependsOn: string[]
  position: number
  rollbackPolicy?: RollbackPolicy
}

const PROMOTABLE_STATUSES = new Set(['COMPLETE', 'PENDING_REVIEW', 'APPROVED', 'EXECUTING'])

export function canPromoteIntentStatus(status: string): boolean {
  return PROMOTABLE_STATUSES.has(status)
}

/**
 * Convert persisted tool calls (dependsOn = ULIDs) into a positional template
 * suitable for re-instantiation via createIntent.
 */
export function buildPipelineTemplate(input: {
  label: string
  description: string
  objective: string
  systems: string[]
  confidence: number | null
  toolCalls: ReadonlyArray<PipelineSourceToolCall>
}): PipelineTemplate {
  const ordered = [...input.toolCalls].sort((a, b) => a.position - b.position)
  const idToPosition = new Map<string, number>()
  for (const tc of ordered) {
    idToPosition.set(tc.id, tc.position)
  }

  const toolCalls: PipelineToolCallTemplate[] = ordered.map((tc) => ({
    tool: tc.tool,
    args: asRecord(tc.args),
    position: tc.position,
    dependsOn: tc.dependsOn.map((ref) => {
      if (ref.startsWith('@')) return ref
      const pos = idToPosition.get(ref)
      if (pos === undefined) return ref
      return `@${pos}`
    }),
    ...(tc.rollbackPolicy ? { rollbackPolicy: tc.rollbackPolicy } : {}),
  }))

  return {
    label: input.label,
    description: input.description,
    objective: input.objective,
    systems: [...input.systems],
    confidence: input.confidence,
    toolCalls,
  }
}

export function buildSeedPipelineTemplate(operatorEmail: string): PipelineTemplate {
  return {
    label: 'Lead follow-up and next-step coordination',
    description:
      'Send a lead follow-up, schedule a next-step call, and notify yourself with a summary.',
    objective: 'Coordinate lead follow-up while preserving human control over real-world actions.',
    systems: ['Gmail', 'GoogleCalendar'],
    confidence: 0.9,
    toolCalls: [
      {
        tool: 'Gmail.SendEmail@7.0.0',
        args: {
          recipient: operatorEmail,
          subject: 'Following up on next steps',
          body: 'Hi team, following up on our conversation. Are you open to a short intro call next week?',
          content_type: 'plain',
        },
        dependsOn: [],
        position: 0,
      },
      {
        tool: 'GoogleCalendar.CreateEvent@3.3.2',
        args: {
          summary: 'Intro call',
          attendee_emails: [operatorEmail],
          start_datetime: '2026-05-26T15:00:00-05:00',
          end_datetime: '2026-05-26T15:30:00-05:00',
          calendar_id: 'primary',
          send_notifications_to_attendees: 'none',
          add_google_meet: true,
        },
        dependsOn: ['@0'],
        position: 1,
      },
      {
        tool: 'Gmail.SendEmail@7.0.0',
        args: {
          recipient: operatorEmail,
          subject: 'AIG pipeline run summary',
          body: 'Lead follow-up sent and next-step call scheduled. This final action gives you a downstream node to inspect or repair.',
          content_type: 'plain',
        },
        dependsOn: ['@1'],
        position: 2,
      },
    ],
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

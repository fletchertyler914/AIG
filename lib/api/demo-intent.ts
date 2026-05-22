import { ulid } from 'ulid'
import { formCandidateIntent, type LabelResult, statusForConfidence } from '@/lib/aig/formation'
import type { CapturedToolCall } from '@/lib/aig/types'
import type { CreateIntentInput } from '@/lib/db/queries'
import { env, isDemoSlackEnabled } from '@/lib/env'

const now = () => Date.now()

function plusAddress(label: string): string {
  const [local, domain] = env.DEMO_USER_ID.split('@')
  if (!local || !domain) return env.DEMO_USER_ID
  return `${local}+${label}@${domain}`
}

function demoCalls(windowId: string): CapturedToolCall[] {
  const capturedAt = now()
  const baseCalls: CapturedToolCall[] = [
    {
      windowId,
      tool: 'Gmail.SendEmail@7.0.0',
      args: {
        recipient: plusAddress('acme'),
        subject: 'Following up on next steps',
        body: 'Hi Acme team, following up on our conversation. Are you open to a short intro call next week?',
        content_type: 'plain',
      },
      capturedAt,
    },
    {
      windowId,
      tool: 'Gmail.SendEmail@7.0.0',
      args: {
        recipient: plusAddress('globex'),
        subject: 'Async follow-up',
        body: 'Hi Globex team, wanted to send over a quick follow-up and keep momentum going.',
        content_type: 'plain',
      },
      capturedAt: capturedAt + 1,
    },
    {
      windowId,
      tool: 'GoogleCalendar.CreateEvent@3.3.2',
      args: {
        summary: 'Acme intro call',
        attendee_emails: [plusAddress('acme')],
        start_datetime: '2026-05-26T15:00:00-05:00',
        end_datetime: '2026-05-26T15:30:00-05:00',
        calendar_id: 'primary',
        send_notifications_to_attendees: 'none',
        add_google_meet: true,
      },
      capturedAt: capturedAt + 2,
    },
    {
      windowId,
      tool: 'GoogleCalendar.CreateEvent@3.3.2',
      args: {
        summary: 'Globex intro call',
        attendee_emails: [plusAddress('globex')],
        start_datetime: '2026-05-27T11:00:00-05:00',
        end_datetime: '2026-05-27T11:30:00-05:00',
        calendar_id: 'primary',
        send_notifications_to_attendees: 'none',
        add_google_meet: true,
      },
      capturedAt: capturedAt + 3,
    },
  ]

  const downstreamSummary: CapturedToolCall = isDemoSlackEnabled
    ? {
        windowId,
        tool: 'Slack.SendMessage@2.5.2',
        args: {
          channel_name: 'sales-team',
          message:
            'Lead follow-up sent. Acme and Globex intro calls are scheduled; CRM can be updated after confirmation.',
        },
        capturedAt: capturedAt + 4,
      }
    : {
        windowId,
        tool: 'Gmail.SendEmail@7.0.0',
        args: {
          recipient: env.DEMO_USER_ID,
          subject: 'AIG demo summary: lead follow-up coordination',
          body: 'Lead follow-up sent. Acme and Globex next-step calls are scheduled. This internal summary is the downstream action that AIG repairs when a calendar action is removed.',
          content_type: 'plain',
        },
        capturedAt: capturedAt + 4,
      }

  return [...baseCalls, downstreamSummary]
}

const demoLabeler = async (): Promise<LabelResult> => ({
  label: 'Lead follow-up and next-step coordination',
  description: isDemoSlackEnabled
    ? 'Send lead follow-up emails, schedule next-step calls, and notify the sales team with a coordinated status update.'
    : 'Send lead follow-up emails, schedule next-step calls, and send an internal summary email with the coordinated status update.',
  objective: 'Coordinate lead follow-up while preserving human control over real-world actions.',
  dependencies: [
    { position: 0, dependsOn: [] },
    { position: 1, dependsOn: [] },
    { position: 2, dependsOn: ['@0'] },
    { position: 3, dependsOn: ['@1'] },
    { position: 4, dependsOn: ['@2', '@3'] },
  ],
})

export async function buildDemoIntentInput(): Promise<CreateIntentInput> {
  const windowId = ulid()
  const candidate = await formCandidateIntent({
    calls: demoCalls(windowId),
    labeler: demoLabeler,
  })

  return {
    label: candidate.label,
    description: candidate.description,
    objective: candidate.objective,
    windowId,
    systems: candidate.systems,
    impact: { ...candidate.impact },
    confidence: candidate.confidence,
    expireAtMs: Date.now() + 5 * 60_000,
    initialStatus: statusForConfidence(candidate.confidence),
    toolCalls: candidate.toolCalls,
    proposedBy: 'agent',
  }
}

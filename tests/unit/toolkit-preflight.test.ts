import { describe, expect, it } from 'vitest'
import {
  formatMissingToolkitsError,
  inferRequestedToolkits,
  missingRequestedToolkits,
} from '@/lib/aig/toolkit-preflight'

describe('toolkit preflight', () => {
  it('infers email and calendar requirements before invoking the plan agent', () => {
    expect(
      inferRequestedToolkits(
        'Email a concise launch update and create a 15-minute calendar reminder tomorrow.',
      ),
    ).toEqual(['Gmail', 'GoogleCalendar'])
  })

  it('detects missing requested toolkits from enabled workspace connections', () => {
    expect(
      missingRequestedToolkits({
        requested: ['Gmail', 'GoogleCalendar'],
        enabled: ['Github', 'GoogleDocs', 'GoogleDrive', 'GoogleSheets'],
      }),
    ).toEqual(['Gmail', 'GoogleCalendar'])
  })

  it('formats a user-actionable missing toolkit error', () => {
    expect(
      formatMissingToolkitsError({
        missing: ['Gmail', 'GoogleCalendar'],
        enabled: ['Github', 'GoogleDocs'],
      }),
    ).toBe(
      'Connect Gmail and GoogleCalendar before creating this intent. Available toolkits in this workspace: Github, GoogleDocs.',
    )
  })
})

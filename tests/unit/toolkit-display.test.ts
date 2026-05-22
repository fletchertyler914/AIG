import { describe, expect, it } from 'vitest'
import {
  formatActionDisplayName,
  formatToolActionTitle,
  formatToolDisplayName,
  formatToolkitDisplayName,
  formatToolMetaLine,
  parseArcadeTool,
} from '@/lib/display/toolkits'

describe('formatToolkitDisplayName', () => {
  it.each([
    ['GoogleCalendar', 'Google Calendar'],
    ['GoogleDrive', 'Google Drive'],
    ['Github', 'GitHub'],
    ['MicrosoftTeams', 'Microsoft Teams'],
    ['Hubspot', 'HubSpot'],
    ['Gmail', 'Gmail'],
    ['Slack', 'Slack'],
  ] as const)('formats %s → %s', (raw, expected) => {
    expect(formatToolkitDisplayName(raw)).toBe(expected)
  })
})

describe('parseArcadeTool', () => {
  it('parses a versioned tool name', () => {
    expect(parseArcadeTool('Gmail.SendEmail@7.0.0')).toEqual({
      toolkit: 'Gmail',
      action: 'SendEmail',
      version: '7.0.0',
      qualified: 'Gmail.SendEmail',
    })
  })

  it('parses a tool name without version', () => {
    expect(parseArcadeTool('GoogleCalendar.CreateEvent')).toEqual({
      toolkit: 'GoogleCalendar',
      action: 'CreateEvent',
      version: null,
      qualified: 'GoogleCalendar.CreateEvent',
    })
  })
})

describe('formatActionDisplayName', () => {
  it('splits camelCase actions', () => {
    expect(formatActionDisplayName('SendEmail')).toBe('Send email')
    expect(formatActionDisplayName('CreateEvent')).toBe('Create event')
  })
})

describe('formatToolActionTitle', () => {
  it('returns a human action title without toolkit or version', () => {
    expect(formatToolActionTitle('GoogleCalendar.CreateEvent@3.3.2')).toBe('Create event')
    expect(formatToolActionTitle('Gmail.SendEmail@7.0.0')).toBe('Send email')
  })
})

describe('formatToolMetaLine', () => {
  it('returns toolkit only by default', () => {
    expect(formatToolMetaLine('Gmail.SendEmail@7.0.0')).toBe('Gmail')
    expect(formatToolMetaLine('GoogleCalendar.CreateEvent@3.3.2')).toBe('Google Calendar')
  })

  it('includes version when requested', () => {
    expect(formatToolMetaLine('Gmail.SendEmail@7.0.0', { version: true })).toBe('Gmail · v7.0.0')
  })
})

describe('formatToolDisplayName', () => {
  it('formats from a fully-qualified Arcade tool name', () => {
    expect(formatToolDisplayName('GoogleCalendar.CreateEvent@3.3.2')).toBe('Google Calendar')
    expect(formatToolDisplayName('Gmail.SendEmail@7.0.0')).toBe('Gmail')
  })
})

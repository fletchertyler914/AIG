import { describe, expect, it } from 'vitest'
import {
  ENTITY_RESOLVER_DEFINITIONS,
  findEntityResolverDefinition,
  resolveEntityResolverRef,
} from '@/lib/display/entity-resolvers'

describe('findEntityResolverDefinition', () => {
  it('matches Google Calendar calendar_id', () => {
    const definition = findEntityResolverDefinition({
      toolName: 'GoogleCalendar.CreateEvent@3.3.2',
      parameterName: 'calendar_id',
    })
    expect(definition?.id).toBe('google-calendar-calendar-id')
    expect(definition?.discoveryTool).toBe('GoogleCalendar.ListCalendars')
  })

  it('does not match unrelated toolkits', () => {
    expect(
      findEntityResolverDefinition({
        toolName: 'Gmail.SendEmail@7.0.0',
        parameterName: 'calendar_id',
      }),
    ).toBeNull()
  })

  it('matches Slack channel_name', () => {
    const definition = findEntityResolverDefinition({
      toolName: 'Slack.SendMessage@2.5.2',
      parameterName: 'channel_name',
    })
    expect(definition?.id).toBe('slack-channel-name')
  })
})

describe('resolveEntityResolverRef', () => {
  it('returns client-safe metadata', () => {
    const ref = resolveEntityResolverRef({
      toolName: 'GoogleCalendar.CreateEvent@3.3.2',
      parameterName: 'calendar_id',
    })
    expect(ref).toMatchObject({
      id: 'google-calendar-calendar-id',
      toolkitName: 'GoogleCalendar',
      freeTextAllowed: true,
    })
    expect(ref).not.toHaveProperty('discoveryTool')
  })
})

describe('normalizeGoogleCalendars', () => {
  it('maps calendar list payloads', () => {
    const definition = ENTITY_RESOLVER_DEFINITIONS.find(
      (entry) => entry.id === 'google-calendar-calendar-id',
    )
    expect(definition).toBeDefined()
    if (!definition) return

    const options = definition.normalize({
      calendars: [
        { id: 'primary', summary: 'Primary', primary: true, accessRole: 'owner' },
        { id: 'work@example.com', summary: 'Work', accessRole: 'writer' },
      ],
    })

    expect(options).toEqual([
      { value: 'primary', label: 'Primary', hint: 'Primary · owner' },
      { value: 'work@example.com', label: 'Work', hint: 'writer' },
    ])
  })

  it('falls back to primary when empty', () => {
    const definition = ENTITY_RESOLVER_DEFINITIONS.find(
      (entry) => entry.id === 'google-calendar-calendar-id',
    )
    expect(definition).toBeDefined()
    if (!definition) return

    const options = definition.normalize({ calendars: [] })
    expect(options[0]).toEqual({
      value: 'primary',
      label: 'Primary calendar',
      hint: 'Default',
    })
  })
})

describe('registry coverage', () => {
  it('includes seeded high-value mappings', () => {
    const ids = ENTITY_RESOLVER_DEFINITIONS.map((entry) => entry.id)
    expect(ids).toContain('google-calendar-calendar-id')
    expect(ids).toContain('slack-channel-name')
    expect(ids).toContain('gmail-labels-to-add')
    expect(ids).toContain('google-drive-parent-folder')
    expect(ids).toContain('linear-team')
    expect(ids).toContain('linear-project')
  })
})

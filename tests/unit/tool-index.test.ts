import { describe, expect, it } from 'vitest'
import { searchTools, type ToolIndexEntry } from '@/lib/arcade/tool-index'

const entries: ToolIndexEntry[] = [
  {
    name: 'Gmail.SendEmail@7.0.0',
    qualifiedName: 'Gmail.SendEmail',
    actionName: 'SendEmail',
    toolkitName: 'Gmail',
    toolkitDisplayName: 'Gmail',
    actionDisplayName: 'Send email',
    description: 'Send an email through Gmail.',
    toolkitDescription: 'Read, draft, and send email.',
    version: '7.0.0',
    requiresAuth: true,
    categories: ['Communication'],
  },
  {
    name: 'GoogleCalendar.CreateEvent@3.3.2',
    qualifiedName: 'GoogleCalendar.CreateEvent',
    actionName: 'CreateEvent',
    toolkitName: 'GoogleCalendar',
    toolkitDisplayName: 'Google Calendar',
    actionDisplayName: 'Create event',
    description: 'Create a calendar event.',
    toolkitDescription: 'Create and manage events.',
    version: '3.3.2',
    requiresAuth: true,
    categories: ['Productivity'],
  },
  {
    name: 'Slack.SendMessage@2.5.2',
    qualifiedName: 'Slack.SendMessage',
    actionName: 'SendMessage',
    toolkitName: 'Slack',
    toolkitDisplayName: 'Slack',
    actionDisplayName: 'Send message',
    description: 'Post a message to Slack.',
    toolkitDescription: 'Team communication.',
    version: '2.5.2',
    requiresAuth: true,
    categories: ['Communication'],
  },
]

describe('searchTools', () => {
  it('ranks exact and prefix matches ahead of description matches', () => {
    const results = searchTools({ entries, query: 'Gmail.SendEmail' })

    expect(results[0]?.name).toBe('Gmail.SendEmail@7.0.0')
  })

  it('finds action display names', () => {
    const results = searchTools({ entries, query: 'create event' })

    expect(results[0]?.name).toBe('GoogleCalendar.CreateEvent@3.3.2')
  })

  it('collapses results to unique toolkits in toolkit mode', () => {
    const gmail = entries[0]
    expect(gmail).toBeDefined()
    if (!gmail) return

    const results = searchTools({
      entries: [
        ...entries,
        {
          ...gmail,
          name: 'Gmail.DraftEmail@7.0.0',
          qualifiedName: 'Gmail.DraftEmail',
          actionName: 'DraftEmail',
          actionDisplayName: 'Draft email',
        },
      ],
      query: 'gmail',
      mode: 'toolkit',
    })

    expect(results.map((entry) => entry.toolkitName)).toEqual(['Gmail'])
  })

  it('honors the limit for empty queries', () => {
    expect(searchTools({ entries, limit: 2 })).toHaveLength(2)
  })
})

import { describe, expect, it } from 'vitest'
import { matchesToolkitSearch, type ToolkitCatalogEntry } from '@/lib/arcade/catalog'

const entry = (name: string, description: string | null = null): ToolkitCatalogEntry => ({
  name,
  description,
  version: null,
  toolCount: 1,
  representativeTool: `${name}.Example@1.0.0`,
  categories: ['General'],
})

describe('matchesToolkitSearch', () => {
  it('matches raw toolkit slugs', () => {
    expect(matchesToolkitSearch(entry('GoogleCalendar'), 'calendar')).toBe(true)
    expect(matchesToolkitSearch(entry('Slack'), 'calendar')).toBe(false)
  })

  it('matches pretty display names', () => {
    expect(matchesToolkitSearch(entry('GoogleCalendar'), 'google calendar')).toBe(true)
    expect(matchesToolkitSearch(entry('Github'), 'github')).toBe(true)
  })

  it('matches descriptions and categories', () => {
    expect(
      matchesToolkitSearch(
        { ...entry('Jira'), categories: ['Developer'], description: 'Track issues' },
        'issues',
      ),
    ).toBe(true)
  })

  it('returns true for an empty query', () => {
    expect(matchesToolkitSearch(entry('Slack'), '')).toBe(true)
  })
})

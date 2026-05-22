import { describe, expect, it } from 'vitest'
import {
  ARCADE_AUTH_PROVIDER_CATALOG,
  inferProviderIdFromToolkit,
  isProviderConfigured,
} from '@/lib/display/auth-providers'

describe('auth provider catalog', () => {
  it('includes all documented Arcade provider families', () => {
    const ids = ARCADE_AUTH_PROVIDER_CATALOG.map((entry) => entry.id)
    expect(ids).toContain('google')
    expect(ids).toContain('microsoft')
    expect(ids).toContain('slack')
    expect(ids).toContain('oauth2')
    expect(ids.length).toBeGreaterThanOrEqual(30)
  })
})

describe('inferProviderIdFromToolkit', () => {
  it('maps Google toolkits to google', () => {
    expect(inferProviderIdFromToolkit('Gmail')).toBe('google')
    expect(inferProviderIdFromToolkit('GoogleCalendar')).toBe('google')
    expect(inferProviderIdFromToolkit('GoogleDrive')).toBe('google')
  })

  it('maps Microsoft toolkits to microsoft', () => {
    expect(inferProviderIdFromToolkit('MicrosoftTeams')).toBe('microsoft')
    expect(inferProviderIdFromToolkit('MicrosoftOutlookMail')).toBe('microsoft')
  })

  it('maps Jira and Confluence to atlassian', () => {
    expect(inferProviderIdFromToolkit('Jira')).toBe('atlassian')
    expect(inferProviderIdFromToolkit('Confluence')).toBe('atlassian')
  })

  it('returns null for unknown or no-auth toolkits', () => {
    expect(inferProviderIdFromToolkit('Math')).toBeNull()
    expect(inferProviderIdFromToolkit('')).toBeNull()
  })
})

describe('isProviderConfigured', () => {
  it('treats missing provider id as ready', () => {
    expect(isProviderConfigured(null, ['google'])).toBe(true)
  })

  it('checks configured provider families', () => {
    expect(isProviderConfigured('google', ['google', 'github'])).toBe(true)
    expect(isProviderConfigured('slack', ['google'])).toBe(false)
  })
})

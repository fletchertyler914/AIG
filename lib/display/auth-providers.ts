/**
 * Arcade OAuth provider families — static catalog aligned with
 * https://docs.arcade.dev/en/references/auth-providers
 *
 * Pure display + mapping helpers (no I/O).
 */

export interface AuthProviderCatalogEntry {
  /** Arcade provider_id slug, e.g. `google`. */
  id: string
  name: string
  description: string
  docsUrl: string
}

const DOCS_BASE = 'https://docs.arcade.dev/en/references/auth-providers'

/** All first-party provider families documented by Arcade (+ generic OAuth 2.0). */
export const ARCADE_AUTH_PROVIDER_CATALOG: AuthProviderCatalogEntry[] = [
  {
    id: 'google',
    name: 'Google',
    description: 'Gmail, Calendar, Drive, Docs, Sheets, YouTube, and more.',
    docsUrl: `${DOCS_BASE}/google`,
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    description: 'Teams, Outlook, OneDrive, SharePoint, Office apps.',
    docsUrl: `${DOCS_BASE}/microsoft`,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repositories, issues, pull requests, and commits.',
    docsUrl: `${DOCS_BASE}/github`,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Channels, messages, and workspace actions.',
    docsUrl: `${DOCS_BASE}/slack`,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Pages, databases, and workspace content.',
    docsUrl: `${DOCS_BASE}/notion`,
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issues, projects, and team workflows.',
    docsUrl: `${DOCS_BASE}/linear`,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM, marketing, and sales tooling.',
    docsUrl: `${DOCS_BASE}/hubspot`,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'CRM records, leads, and opportunities.',
    docsUrl: `${DOCS_BASE}/salesforce`,
  },
  {
    id: 'atlassian',
    name: 'Atlassian',
    description: 'Jira, Confluence, and Atlassian Cloud.',
    docsUrl: `${DOCS_BASE}/atlassian`,
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Tasks, projects, and team work.',
    docsUrl: `${DOCS_BASE}/asana`,
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Bases, tables, and records.',
    docsUrl: `${DOCS_BASE}/airtable`,
  },
  {
    id: 'attio',
    name: 'Attio',
    description: 'CRM and relationship data.',
    docsUrl: `${DOCS_BASE}/attio`,
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Scheduling and calendar links.',
    docsUrl: `${DOCS_BASE}/calendly`,
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Tasks, docs, and workspace management.',
    docsUrl: `${DOCS_BASE}/clickup`,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Servers, channels, and messages.',
    docsUrl: `${DOCS_BASE}/discord`,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Files and shared folders.',
    docsUrl: `${DOCS_BASE}/dropbox`,
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Design files and comments.',
    docsUrl: `${DOCS_BASE}/figma`,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Profile and social actions.',
    docsUrl: `${DOCS_BASE}/linkedin`,
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Audiences and campaigns.',
    docsUrl: `${DOCS_BASE}/mailchimp`,
  },
  {
    id: 'miro',
    name: 'Miro',
    description: 'Boards and collaborative whiteboards.',
    docsUrl: `${DOCS_BASE}/miro`,
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    description: 'Incidents and on-call schedules.',
    docsUrl: `${DOCS_BASE}/pagerduty`,
  },
  {
    id: 'reddit',
    name: 'Reddit',
    description: 'Posts, comments, and subreddits.',
    docsUrl: `${DOCS_BASE}/reddit`,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Playlists, tracks, and library.',
    docsUrl: `${DOCS_BASE}/spotify`,
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Payments and commerce APIs.',
    docsUrl: `${DOCS_BASE}/square`,
  },
  {
    id: 'ticktick',
    name: 'TickTick',
    description: 'Tasks and reminders.',
    docsUrl: `${DOCS_BASE}/ticktick`,
  },
  {
    id: 'twitch',
    name: 'Twitch',
    description: 'Streams and channel data.',
    docsUrl: `${DOCS_BASE}/twitch`,
  },
  {
    id: 'x',
    name: 'X',
    description: 'Posts and social actions (Twitter).',
    docsUrl: `${DOCS_BASE}/x`,
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    description: 'Tickets and customer support.',
    docsUrl: `${DOCS_BASE}/zendesk`,
  },
  {
    id: 'zoho',
    name: 'Zoho',
    description: 'Zoho Books, Creator, and suite apps.',
    docsUrl: `${DOCS_BASE}/zoho`,
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Meetings and calendar events.',
    docsUrl: `${DOCS_BASE}/zoom`,
  },
  {
    id: 'oauth2',
    name: 'OAuth 2.0 (custom)',
    description: 'Any OAuth 2.0-compatible provider not listed above.',
    docsUrl: `${DOCS_BASE}/oauth2`,
  },
]

const CATALOG_BY_ID = new Map(ARCADE_AUTH_PROVIDER_CATALOG.map((entry) => [entry.id, entry]))

/** Prefix / name heuristics map Arcade toolkit names → OAuth provider family. */
const TOOLKIT_PREFIX_TO_PROVIDER: ReadonlyArray<[prefix: string, providerId: string]> = [
  ['google', 'google'],
  ['gmail', 'google'],
  ['youtube', 'google'],
  ['microsoft', 'microsoft'],
  ['github', 'github'],
  ['slack', 'slack'],
  ['notion', 'notion'],
  ['linear', 'linear'],
  ['hubspot', 'hubspot'],
  ['salesforce', 'salesforce'],
  ['jira', 'atlassian'],
  ['confluence', 'atlassian'],
  ['atlassian', 'atlassian'],
  ['asana', 'asana'],
  ['airtable', 'airtable'],
  ['attio', 'attio'],
  ['calendly', 'calendly'],
  ['clickup', 'clickup'],
  ['discord', 'discord'],
  ['dropbox', 'dropbox'],
  ['figma', 'figma'],
  ['linkedin', 'linkedin'],
  ['mailchimp', 'mailchimp'],
  ['miro', 'miro'],
  ['pagerduty', 'pagerduty'],
  ['reddit', 'reddit'],
  ['spotify', 'spotify'],
  ['square', 'square'],
  ['squareup', 'square'],
  ['ticktick', 'ticktick'],
  ['twitch', 'twitch'],
  ['zendesk', 'zendesk'],
  ['zoho', 'zoho'],
  ['zoom', 'zoom'],
  ['stripe', 'oauth2'],
  ['xero', 'oauth2'],
  ['telegram', 'oauth2'],
]

export function formatAuthProviderName(providerId: string): string {
  return CATALOG_BY_ID.get(providerId)?.name ?? providerId
}

export function getAuthProviderCatalogEntry(providerId: string): AuthProviderCatalogEntry | null {
  return CATALOG_BY_ID.get(providerId) ?? null
}

/**
 * Best-effort mapping from an Arcade toolkit name to an OAuth provider family.
 * Returns null when auth is unknown or likely API-key / no-auth.
 */
export function inferProviderIdFromToolkit(toolkitName: string): string | null {
  const normalized = toolkitName.trim()
  if (!normalized) return null

  const lower = normalized.toLowerCase()

  for (const [prefix, providerId] of TOOLKIT_PREFIX_TO_PROVIDER) {
    if (lower === prefix || lower.startsWith(prefix)) return providerId
  }

  if (lower === 'x' || lower.startsWith('twitter')) return 'x'

  if (CATALOG_BY_ID.has(lower)) return lower

  return null
}

export function isProviderConfigured(
  providerId: string | null,
  configuredProviderIds: ReadonlySet<string> | ReadonlyArray<string>,
): boolean {
  if (!providerId) return true
  const set =
    configuredProviderIds instanceof Set ? configuredProviderIds : new Set(configuredProviderIds)
  return set.has(providerId)
}

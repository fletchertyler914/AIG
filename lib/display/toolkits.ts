/**
 * Human-readable labels for Arcade toolkit identifiers.
 *
 * API / DB values stay CamelCase (e.g. `GoogleCalendar`). UI uses these helpers.
 * Lives outside `lib/arcade/` so components can import without crossing the Arcade boundary.
 */

/** Parsed segments of a fully-qualified Arcade tool name. */
export interface ParsedArcadeTool {
  /** Toolkit slug, e.g. `Gmail`. */
  toolkit: string
  /** Action slug without version, e.g. `SendEmail`. */
  action: string
  /** Semver suffix when present, e.g. `7.0.0`. */
  version: string | null
  /** Qualified name without version, e.g. `Gmail.SendEmail`. */
  qualified: string
}

/** Exact overrides for known Arcade toolkit slugs. */
const TOOLKIT_DISPLAY_NAMES: Record<string, string> = {
  Gmail: 'Gmail',
  GoogleCalendar: 'Google Calendar',
  GoogleDrive: 'Google Drive',
  GoogleDocs: 'Google Docs',
  GoogleSheets: 'Google Sheets',
  GoogleSlides: 'Google Slides',
  GoogleContacts: 'Google Contacts',
  GoogleMaps: 'Google Maps',
  GoogleSearch: 'Google Search',
  Github: 'GitHub',
  Gitlab: 'GitLab',
  Slack: 'Slack',
  Notion: 'Notion',
  Linear: 'Linear',
  Hubspot: 'HubSpot',
  Stripe: 'Stripe',
  MicrosoftTeams: 'Microsoft Teams',
  MicrosoftOutlook: 'Microsoft Outlook',
  MicrosoftExcel: 'Microsoft Excel',
  MicrosoftWord: 'Microsoft Word',
  MicrosoftSharePoint: 'Microsoft SharePoint',
  LinkedIn: 'LinkedIn',
  YouTube: 'YouTube',
  X: 'X',
  Salesforce: 'Salesforce',
  Jira: 'Jira',
  Confluence: 'Confluence',
  Asana: 'Asana',
  ClickUp: 'ClickUp',
  Dropbox: 'Dropbox',
  Zoom: 'Zoom',
  Reddit: 'Reddit',
  Spotify: 'Spotify',
  Telegram: 'Telegram',
  PagerDuty: 'PagerDuty',
  Datadog: 'Datadog',
  PostHog: 'PostHog',
  Firecrawl: 'Firecrawl',
}

function splitCamelCase(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
}

/**
 * Parse `Gmail.SendEmail@7.0.0` into toolkit, action, and optional version.
 */
export function parseArcadeTool(tool: string): ParsedArcadeTool {
  const trimmed = tool.trim()
  const at = trimmed.indexOf('@')
  const base = at === -1 ? trimmed : trimmed.slice(0, at)
  const version = at === -1 ? null : trimmed.slice(at + 1)
  const dot = base.indexOf('.')

  if (dot === -1) {
    return {
      toolkit: base,
      action: base,
      version,
      qualified: base,
    }
  }

  const toolkit = base.slice(0, dot)
  const action = base.slice(dot + 1)
  return { toolkit, action, version, qualified: `${toolkit}.${action}` }
}

/**
 * Turn an Arcade toolkit slug into a display label.
 * `GoogleCalendar` → `Google Calendar`, `Github` → `GitHub`.
 */
export function formatToolkitDisplayName(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return raw

  const override = TOOLKIT_DISPLAY_NAMES[trimmed]
  if (override) return override

  return splitCamelCase(trimmed)
}

/** Human-readable action label, e.g. `SendEmail` → `Send email`. */
export function formatActionDisplayName(action: string): string {
  const trimmed = action.trim()
  if (!trimmed) return action
  const words = splitCamelCase(trimmed).split(/\s+/)
  if (words.length === 0) return trimmed
  const [first, ...rest] = words
  return [first, ...rest.map((word) => word.toLowerCase())].join(' ')
}

/** Primary title for a tool call — action only, never includes version. */
export function formatToolActionTitle(tool: string): string {
  const { action } = parseArcadeTool(tool)
  return formatActionDisplayName(action)
}

/**
 * Secondary meta line for a tool call — pretty toolkit, version optional.
 * `Gmail.SendEmail@7.0.0` → `Gmail · v7.0.0` or `Gmail` when version omitted.
 */
export function formatToolMetaLine(tool: string, options?: { version?: boolean }): string {
  const { toolkit, version } = parseArcadeTool(tool)
  const prettyToolkit = formatToolkitDisplayName(toolkit)
  const showVersion = options?.version ?? false
  if (showVersion && version) return `${prettyToolkit} · v${version}`
  return prettyToolkit
}

/** Extract toolkit slug from a fully-qualified tool name and format it. */
export function formatToolDisplayName(tool: string): string {
  const { toolkit } = parseArcadeTool(tool)
  return formatToolkitDisplayName(toolkit)
}

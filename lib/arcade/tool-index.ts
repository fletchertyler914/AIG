import type { ToolDefinition } from '@arcadeai/arcadejs/resources/tools/tools'
import { formatActionDisplayName, formatToolkitDisplayName } from '@/lib/display/toolkits'
import { isArcadeMocked } from '@/lib/env'
import { getArcadeClient } from './client'

const CACHE_TTL_MS = 30 * 60_000
const DEFAULT_SEARCH_LIMIT = 20

export interface ToolIndexEntry {
  name: string
  qualifiedName: string
  actionName: string
  toolkitName: string
  toolkitDisplayName: string
  actionDisplayName: string
  description: string | null
  toolkitDescription: string | null
  version: string | null
  requiresAuth: boolean
  categories: string[]
}

export interface ToolDetail extends ToolIndexEntry {
  input: ToolDefinition.Input
}

const MOCK_TOOLS: ToolDefinition[] = [
  {
    fully_qualified_name: 'Gmail.SendEmail@7.0.0',
    qualified_name: 'Gmail.SendEmail',
    name: 'SendEmail',
    description: 'Send an email through Gmail.',
    input: {
      parameters: [
        {
          name: 'recipient',
          description: 'Email recipient.',
          required: true,
          value_schema: { val_type: 'string' },
        },
        {
          name: 'subject',
          description: 'Email subject.',
          required: true,
          value_schema: { val_type: 'string' },
        },
        {
          name: 'body',
          description: 'Email body.',
          required: true,
          value_schema: { val_type: 'string' },
        },
        {
          name: 'content_type',
          description: 'Email body format.',
          required: false,
          value_schema: { val_type: 'string', enum: ['plain', 'html'] },
        },
      ],
    },
    toolkit: {
      name: 'Gmail',
      description: 'Read, draft, and send email with Gmail.',
      version: '7.0.0',
    },
    requirements: {
      authorization: { status: 'inactive', token_status: 'not_started' },
    },
    metadata: { classification: { service_domains: ['Communication'] } },
  },
  {
    fully_qualified_name: 'GoogleCalendar.CreateEvent@3.3.2',
    qualified_name: 'GoogleCalendar.CreateEvent',
    name: 'CreateEvent',
    description: 'Create a Google Calendar event.',
    input: {
      parameters: [
        {
          name: 'summary',
          description: 'Event title.',
          required: true,
          value_schema: { val_type: 'string' },
        },
        {
          name: 'start_datetime',
          description: 'Start date/time.',
          required: true,
          value_schema: { val_type: 'datetime' },
        },
        {
          name: 'end_datetime',
          description: 'End date/time.',
          required: true,
          value_schema: { val_type: 'datetime' },
        },
        {
          name: 'attendee_emails',
          description: 'Attendees.',
          required: false,
          value_schema: { val_type: 'array', inner_val_type: 'string' },
        },
      ],
    },
    toolkit: {
      name: 'GoogleCalendar',
      description: 'Create and manage Google Calendar events.',
      version: '3.3.2',
    },
    requirements: {
      authorization: { status: 'inactive', token_status: 'not_started' },
    },
    metadata: { classification: { service_domains: ['Productivity'] } },
  },
  {
    fully_qualified_name: 'Slack.SendMessage@2.5.2',
    qualified_name: 'Slack.SendMessage',
    name: 'SendMessage',
    description: 'Send a message in Slack.',
    input: {
      parameters: [
        {
          name: 'channel',
          required: true,
          value_schema: { val_type: 'string' },
        },
        {
          name: 'message',
          required: true,
          value_schema: { val_type: 'string' },
        },
      ],
    },
    toolkit: {
      name: 'Slack',
      description: 'Send messages and work with Slack channels.',
      version: '2.5.2',
    },
    requirements: {
      authorization: { status: 'inactive', token_status: 'not_started' },
    },
    metadata: { classification: { service_domains: ['Communication'] } },
  },
]

const cacheByUserId = new Map<
  string,
  {
    expiresAt: number
    fetchedAt: number
    entries: ToolDetail[]
  }
>()

const inflightByUserId = new Map<string, Promise<ToolDetail[]>>()

export async function listArcadeToolIndex(options: {
  arcadeUserId: string
  force?: boolean
  signal?: AbortSignal
}): Promise<ToolDetail[]> {
  if (isArcadeMocked) return MOCK_TOOLS.map(toToolDetail)

  const now = Date.now()
  const cached = cacheByUserId.get(options.arcadeUserId)
  if (!options.force && cached && cached.expiresAt > now) return cached.entries

  const inflight = inflightByUserId.get(options.arcadeUserId)
  if (inflight) return inflight

  const promise = fetchToolIndex(options.arcadeUserId, options.signal)
  inflightByUserId.set(options.arcadeUserId, promise)

  try {
    const entries = await promise
    cacheByUserId.set(options.arcadeUserId, {
      entries,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
    return entries
  } finally {
    inflightByUserId.delete(options.arcadeUserId)
  }
}

export function searchTools(input: {
  entries: ReadonlyArray<ToolIndexEntry>
  query?: string
  mode?: 'tool' | 'toolkit'
  limit?: number
}): ToolIndexEntry[] {
  const query = input.query?.trim().toLowerCase() ?? ''
  const limit = input.limit ?? DEFAULT_SEARCH_LIMIT
  const candidates = input.mode === 'toolkit' ? collapseToToolkits(input.entries) : input.entries

  if (!query) return candidates.slice(0, limit)

  return candidates
    .map((entry) => ({ entry, score: scoreTool(entry, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((result) => result.entry)
}

export async function getArcadeToolDetail(input: {
  arcadeUserId: string
  toolName: string
  signal?: AbortSignal
}): Promise<ToolDetail | null> {
  const tools = await listArcadeToolIndex(input)
  const lower = input.toolName.toLowerCase()
  const cached = tools.find(
    (tool) => tool.name.toLowerCase() === lower || tool.qualifiedName.toLowerCase() === lower,
  )
  if (cached) return cached

  if (isArcadeMocked) return null

  const arcade = getArcadeClient()
  try {
    const toolDef = await arcade.tools.get(
      input.toolName,
      { user_id: input.arcadeUserId },
      input.signal ? { signal: input.signal } : undefined,
    )
    return toToolDetail(toolDef)
  } catch {
    return null
  }
}

async function fetchToolIndex(arcadeUserId: string, signal?: AbortSignal): Promise<ToolDetail[]> {
  const arcade = getArcadeClient()
  const entries: ToolDetail[] = []

  for await (const toolDef of arcade.tools.list(
    { user_id: arcadeUserId, limit: 200 },
    signal ? { signal } : undefined,
  )) {
    entries.push(toToolDetail(toolDef))
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

function collapseToToolkits(entries: ReadonlyArray<ToolIndexEntry>): ToolIndexEntry[] {
  const byToolkit = new Map<string, ToolIndexEntry>()
  for (const entry of entries) {
    const existing = byToolkit.get(entry.toolkitName)
    if (!existing || entry.name < existing.name) {
      byToolkit.set(entry.toolkitName, entry)
    }
  }
  return Array.from(byToolkit.values()).sort((a, b) => a.toolkitName.localeCompare(b.toolkitName))
}

function scoreTool(entry: ToolIndexEntry, query: string): number {
  const fields = {
    name: entry.name.toLowerCase(),
    qualified: entry.qualifiedName.toLowerCase(),
    action: entry.actionDisplayName.toLowerCase(),
    toolkit: entry.toolkitDisplayName.toLowerCase(),
    description: (entry.description ?? '').toLowerCase(),
    categories: entry.categories.join(' ').toLowerCase(),
  }

  if (fields.name === query || fields.qualified === query) return 100
  if (fields.name.startsWith(query) || fields.qualified.startsWith(query)) return 80
  if (fields.toolkit === query || entry.toolkitName.toLowerCase() === query) return 75
  if (fields.action.includes(query)) return 65
  if (fields.name.includes(query) || fields.qualified.includes(query)) return 60
  if (fields.toolkit.includes(query) || entry.toolkitName.toLowerCase().includes(query)) return 50
  if (fields.description.includes(query)) return 30
  if (fields.categories.includes(query)) return 20
  return 0
}

function toToolDetail(toolDef: ToolDefinition): ToolDetail {
  const categories = inferCategories(toolDef)
  const version = versionFromTool(toolDef)
  return {
    name: toolDef.fully_qualified_name,
    qualifiedName: toolDef.qualified_name,
    actionName: toolDef.name,
    toolkitName: toolDef.toolkit.name,
    toolkitDisplayName: formatToolkitDisplayName(toolDef.toolkit.name),
    actionDisplayName: formatActionDisplayName(toolDef.name),
    description: toolDef.description ?? null,
    toolkitDescription: toolDef.toolkit.description ?? null,
    version,
    requiresAuth: Boolean(toolDef.requirements?.authorization),
    categories,
    input: toolDef.input,
  }
}

function versionFromTool(toolDef: ToolDefinition): string | null {
  const at = toolDef.fully_qualified_name.indexOf('@')
  if (at !== -1) return toolDef.fully_qualified_name.slice(at + 1)
  return toolDef.toolkit.version ?? null
}

function inferCategories(toolDef: ToolDefinition): string[] {
  const domains = toolDef.metadata?.classification?.service_domains ?? []
  if (domains.length > 0) return domains.sort()

  const name = toolDef.toolkit.name.toLowerCase()
  if (name.includes('github') || name.includes('gitlab') || name.includes('linear')) {
    return ['Developer']
  }
  if (name.includes('slack') || name.includes('gmail') || name.includes('mail')) {
    return ['Communication']
  }
  if (name.includes('calendar') || name.includes('drive') || name.includes('notion')) {
    return ['Productivity']
  }
  return ['General']
}

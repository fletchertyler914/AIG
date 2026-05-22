import type { ToolDefinition } from '@arcadeai/arcadejs/resources/tools/tools'
import { formatToolkitDisplayName } from '@/lib/display/toolkits'
import { isArcadeMocked } from '@/lib/env'
import { getArcadeClient } from './client'

export interface ToolkitCatalogEntry {
  name: string
  description: string | null
  version: string | null
  toolCount: number
  representativeTool: string
  categories: string[]
}

/** Default connections-page toolkits — fetched in parallel via `client.tools.list({ toolkit })`. */
export const CURATED_TOOLKITS = [
  'Gmail',
  'GoogleCalendar',
  'GoogleDrive',
  'GoogleDocs',
  'GoogleSheets',
  'Github',
  'Slack',
  'Notion',
  'Linear',
  'Hubspot',
  'Stripe',
  'MicrosoftTeams',
] as const

const CACHE_TTL_MS = 30 * 60_000

const cacheByUserId = new Map<
  string,
  {
    expiresAt: number
    fetchedAt: number
    entries: ToolkitCatalogEntry[]
  }
>()

const inflightByUserId = new Map<string, Promise<ToolkitCatalogEntry[]>>()

const fullIndexCacheByUserId = new Map<
  string,
  {
    expiresAt: number
    fetchedAt: number
    entries: ToolkitCatalogEntry[]
  }
>()

const fullIndexInflightByUserId = new Map<string, Promise<ToolkitCatalogEntry[]>>()

const MOCK_TOOLKITS: ToolkitCatalogEntry[] = [
  {
    name: 'Gmail',
    description: 'Read, draft, and send email with Gmail.',
    version: null,
    toolCount: 12,
    representativeTool: 'Gmail.SendEmail@7.0.0',
    categories: ['Productivity', 'Communication'],
  },
  {
    name: 'GoogleCalendar',
    description: 'Create and manage Google Calendar events.',
    version: null,
    toolCount: 8,
    representativeTool: 'GoogleCalendar.CreateEvent@3.3.2',
    categories: ['Productivity'],
  },
  {
    name: 'Github',
    description: 'Inspect repositories, issues, pull requests, and commits.',
    version: null,
    toolCount: 24,
    representativeTool: 'Github.GetRepository@1.0.0',
    categories: ['Developer'],
  },
  {
    name: 'Slack',
    description: 'Send messages and work with Slack channels.',
    version: null,
    toolCount: 16,
    representativeTool: 'Slack.SendMessage@2.5.2',
    categories: ['Communication'],
  },
]

export function getCatalogCacheMeta(arcadeUserId: string): {
  fetchedAt: number | null
  stale: boolean
} {
  const cached = cacheByUserId.get(arcadeUserId)
  if (!cached) return { fetchedAt: null, stale: true }
  return { fetchedAt: cached.fetchedAt, stale: cached.expiresAt <= Date.now() }
}

export async function listArcadeToolkitCatalog(options: {
  arcadeUserId: string
  force?: boolean
  signal?: AbortSignal
}): Promise<ToolkitCatalogEntry[]> {
  if (isArcadeMocked) return MOCK_TOOLKITS

  const now = Date.now()
  const cached = cacheByUserId.get(options.arcadeUserId)
  if (!options.force && cached && cached.expiresAt > now) return cached.entries

  const inflight = inflightByUserId.get(options.arcadeUserId)
  if (inflight) return inflight

  const promise = fetchCuratedCatalog(options.arcadeUserId, options.signal)
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

/**
 * Full toolkit index via SDK `client.tools.list()` pagination.
 * Arcade has no `/v1/toolkits` or search param — dedupe `tool.toolkit.name` per
 * https://github.com/ArcadeAI/arcade-mcp/discussions/445
 */
export async function listArcadeToolkitIndex(options: {
  arcadeUserId: string
  force?: boolean
  signal?: AbortSignal
}): Promise<ToolkitCatalogEntry[]> {
  if (isArcadeMocked) return MOCK_TOOLKITS

  const now = Date.now()
  const cached = fullIndexCacheByUserId.get(options.arcadeUserId)
  if (!options.force && cached && cached.expiresAt > now) return cached.entries

  const inflight = fullIndexInflightByUserId.get(options.arcadeUserId)
  if (inflight) return inflight

  const promise = fetchFullToolkitIndex(options.arcadeUserId, options.signal)
  fullIndexInflightByUserId.set(options.arcadeUserId, promise)

  try {
    const entries = await promise
    fullIndexCacheByUserId.set(options.arcadeUserId, {
      entries,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
    return entries
  } finally {
    fullIndexInflightByUserId.delete(options.arcadeUserId)
  }
}

export function matchesToolkitSearch(entry: ToolkitCatalogEntry, query: string): boolean {
  // Client-side filter only — `ToolListParams` has metadata `filter`, not name search.
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  const pretty = formatToolkitDisplayName(entry.name).toLowerCase()
  return (
    entry.name.toLowerCase().includes(needle) ||
    pretty.includes(needle) ||
    (entry.description ?? '').toLowerCase().includes(needle) ||
    entry.categories.some((category) => category.toLowerCase().includes(needle))
  )
}

export async function listArcadeToolkitCatalogForConnections(input: {
  arcadeUserId: string
  query?: string
  force?: boolean
  signal?: AbortSignal
}): Promise<{ entries: ToolkitCatalogEntry[]; indexTotal: number | null }> {
  const query = input.query?.trim() ?? ''
  if (!query) {
    const entries = await listArcadeToolkitCatalog(input)
    return { entries, indexTotal: null }
  }

  const index = await listArcadeToolkitIndex(input)
  return {
    entries: index.filter((entry) => matchesToolkitSearch(entry, query)),
    indexTotal: index.length,
  }
}

export async function getArcadeToolkitCatalogEntry(input: {
  arcadeUserId: string
  toolkitName: string
  signal?: AbortSignal
}): Promise<ToolkitCatalogEntry | null> {
  const catalog = await listArcadeToolkitCatalog({
    arcadeUserId: input.arcadeUserId,
    ...(input.signal ? { signal: input.signal } : {}),
  })
  const lower = input.toolkitName.toLowerCase()
  const fromCatalog = catalog.find((entry) => entry.name.toLowerCase() === lower)
  if (fromCatalog) return fromCatalog

  return fetchSingleToolkitCatalogEntry({
    arcadeUserId: input.arcadeUserId,
    toolkitName: input.toolkitName,
    ...(input.signal ? { signal: input.signal } : {}),
  })
}

async function fetchFullToolkitIndex(
  arcadeUserId: string,
  signal?: AbortSignal,
): Promise<ToolkitCatalogEntry[]> {
  const arcade = getArcadeClient()
  const byToolkit = new Map<string, ToolkitAccumulator>()

  for await (const toolDef of arcade.tools.list(
    { user_id: arcadeUserId, limit: 200 },
    signal ? { signal } : undefined,
  )) {
    addTool(byToolkit, toolDef)
  }

  return Array.from(byToolkit.values())
    .map(toCatalogEntry)
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function fetchCuratedCatalog(
  arcadeUserId: string,
  signal?: AbortSignal,
): Promise<ToolkitCatalogEntry[]> {
  const results = await Promise.all(
    CURATED_TOOLKITS.map((toolkit) =>
      fetchSingleToolkitCatalogEntry({
        arcadeUserId,
        toolkitName: toolkit,
        ...(signal ? { signal } : {}),
      }),
    ),
  )

  return results
    .filter((entry): entry is ToolkitCatalogEntry => entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function fetchSingleToolkitCatalogEntry(input: {
  arcadeUserId: string
  toolkitName: string
  signal?: AbortSignal
}): Promise<ToolkitCatalogEntry | null> {
  if (isArcadeMocked) {
    return (
      MOCK_TOOLKITS.find((t) => t.name.toLowerCase() === input.toolkitName.toLowerCase()) ?? null
    )
  }

  const arcade = getArcadeClient()
  const page = await arcade.tools.list(
    {
      user_id: input.arcadeUserId,
      toolkit: input.toolkitName,
      limit: 100,
    },
    input.signal ? { signal: input.signal } : undefined,
  )

  if (page.items.length === 0) return null

  const byToolkit = new Map<string, ToolkitAccumulator>()
  for (const toolDef of page.items) {
    addTool(byToolkit, toolDef)
  }

  const entry = byToolkit.get(input.toolkitName) ?? byToolkit.values().next().value
  return entry ? toCatalogEntry(entry) : null
}

interface ToolkitAccumulator {
  name: string
  description: string | null
  version: string | null
  representativeTool: string
  toolCount: number
  categories: Set<string>
}

function addTool(byToolkit: Map<string, ToolkitAccumulator>, toolDef: ToolDefinition): void {
  const name = toolDef.toolkit.name
  const existing = byToolkit.get(name)
  if (existing) {
    existing.toolCount += 1
    for (const category of inferCategories(name, toolDef)) {
      existing.categories.add(category)
    }
    return
  }

  byToolkit.set(name, {
    name,
    description: toolDef.toolkit.description ?? toolDef.description ?? null,
    version: toolDef.toolkit.version ?? null,
    representativeTool: toolDef.fully_qualified_name,
    toolCount: 1,
    categories: new Set(inferCategories(name, toolDef)),
  })
}

function toCatalogEntry(acc: ToolkitAccumulator): ToolkitCatalogEntry {
  return {
    name: acc.name,
    description: acc.description,
    version: acc.version,
    representativeTool: acc.representativeTool,
    toolCount: acc.toolCount,
    categories: Array.from(acc.categories).sort(),
  }
}

function inferCategories(toolkitName: string, toolDef: ToolDefinition): string[] {
  const metadata = toolDef.metadata as
    | {
        classification?: { category?: string; categories?: string[] }
      }
    | undefined

  const fromMetadata = [
    metadata?.classification?.category,
    ...(metadata?.classification?.categories ?? []),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)

  if (fromMetadata.length > 0) return fromMetadata

  const name = toolkitName.toLowerCase()
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

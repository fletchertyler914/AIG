/**
 * Pure registry mapping Arcade tool arguments to discovery tools.
 * Safe for components and unit tests — no I/O.
 */

import { parseArcadeTool } from '@/lib/display/toolkits'

export interface EntityOption {
  value: string
  label: string
  hint?: string
}

/** Client-safe resolver metadata attached to ArgField. */
export interface EntityResolverRef {
  id: string
  toolkitName: string
  loadingLabel: string
  connectLabel: string
  freeTextAllowed: true
  /** When true, picker appends selections to a string-list field. */
  multiValue?: boolean
}

export interface EntityDiscoveryInput {
  query?: string
  limit?: number
}

export interface EntityResolverDefinition {
  id: string
  toolkitName: string
  parameterName: string
  discoveryTool: string
  loadingLabel: string
  connectLabel: string
  freeTextAllowed: true
  multiValue?: boolean
  buildDiscoveryArgs: (input: EntityDiscoveryInput) => Record<string, unknown>
  normalize: (output: unknown) => EntityOption[]
}

const DEFAULT_LIMIT = 50

export const ENTITY_RESOLVER_DEFINITIONS: readonly EntityResolverDefinition[] = [
  {
    id: 'google-calendar-calendar-id',
    toolkitName: 'GoogleCalendar',
    parameterName: 'calendar_id',
    discoveryTool: 'GoogleCalendar.ListCalendars',
    loadingLabel: 'Loading your calendars…',
    connectLabel: 'Connect Google Calendar',
    freeTextAllowed: true,
    buildDiscoveryArgs: (input) => ({
      max_results: input.limit ?? DEFAULT_LIMIT,
      show_hidden: false,
      show_deleted: false,
    }),
    normalize: normalizeGoogleCalendars,
  },
  {
    id: 'slack-channel-name',
    toolkitName: 'Slack',
    parameterName: 'channel_name',
    discoveryTool: 'Slack.ListConversations',
    loadingLabel: 'Loading Slack channels…',
    connectLabel: 'Connect Slack',
    freeTextAllowed: true,
    buildDiscoveryArgs: (input) => ({
      conversation_types: ['public_channel', 'private_channel'],
      limit: input.limit ?? DEFAULT_LIMIT,
    }),
    normalize: normalizeSlackConversations,
  },
  {
    id: 'slack-conversation-id',
    toolkitName: 'Slack',
    parameterName: 'conversation_id',
    discoveryTool: 'Slack.ListConversations',
    loadingLabel: 'Loading Slack conversations…',
    connectLabel: 'Connect Slack',
    freeTextAllowed: true,
    buildDiscoveryArgs: (input) => ({
      limit: input.limit ?? DEFAULT_LIMIT,
    }),
    normalize: normalizeSlackConversations,
  },
  {
    id: 'gmail-labels-to-add',
    toolkitName: 'Gmail',
    parameterName: 'labels_to_add',
    discoveryTool: 'Gmail.ListLabels',
    loadingLabel: 'Loading Gmail labels…',
    connectLabel: 'Connect Gmail',
    freeTextAllowed: true,
    multiValue: true,
    buildDiscoveryArgs: () => ({}),
    normalize: normalizeGmailLabels,
  },
  {
    id: 'gmail-labels-to-remove',
    toolkitName: 'Gmail',
    parameterName: 'labels_to_remove',
    discoveryTool: 'Gmail.ListLabels',
    loadingLabel: 'Loading Gmail labels…',
    connectLabel: 'Connect Gmail',
    freeTextAllowed: true,
    multiValue: true,
    buildDiscoveryArgs: () => ({}),
    normalize: normalizeGmailLabels,
  },
  {
    id: 'google-drive-parent-folder',
    toolkitName: 'GoogleDrive',
    parameterName: 'parent_folder_path_or_id',
    discoveryTool: 'GoogleDrive.GetFileTreeStructure',
    loadingLabel: 'Loading Drive folders…',
    connectLabel: 'Connect Google Drive',
    freeTextAllowed: true,
    buildDiscoveryArgs: (input) => ({
      limit: input.limit ?? DEFAULT_LIMIT,
    }),
    normalize: normalizeGoogleDriveTree,
  },
  {
    id: 'google-drive-destination-folder',
    toolkitName: 'GoogleDrive',
    parameterName: 'destination_folder_path_or_id',
    discoveryTool: 'GoogleDrive.GetFileTreeStructure',
    loadingLabel: 'Loading Drive folders…',
    connectLabel: 'Connect Google Drive',
    freeTextAllowed: true,
    buildDiscoveryArgs: (input) => ({
      limit: input.limit ?? DEFAULT_LIMIT,
    }),
    normalize: normalizeGoogleDriveTree,
  },
  {
    id: 'google-drive-folder-path',
    toolkitName: 'GoogleDrive',
    parameterName: 'folder_path_or_id',
    discoveryTool: 'GoogleDrive.SearchFiles',
    loadingLabel: 'Searching Drive…',
    connectLabel: 'Connect Google Drive',
    freeTextAllowed: true,
    buildDiscoveryArgs: (input) => ({
      query: input.query?.trim() || 'folder',
      limit: input.limit ?? DEFAULT_LIMIT,
    }),
    normalize: normalizeGoogleDriveSearch,
  },
  {
    id: 'linear-team',
    toolkitName: 'Linear',
    parameterName: 'team',
    discoveryTool: 'Linear.ListTeams',
    loadingLabel: 'Loading Linear teams…',
    connectLabel: 'Connect Linear',
    freeTextAllowed: true,
    buildDiscoveryArgs: (input) => ({
      ...(input.query?.trim() ? { keywords: input.query.trim() } : {}),
      limit: input.limit ?? DEFAULT_LIMIT,
    }),
    normalize: normalizeLinearTeams,
  },
  {
    id: 'linear-project',
    toolkitName: 'Linear',
    parameterName: 'project',
    discoveryTool: 'Linear.ListProjects',
    loadingLabel: 'Loading Linear projects…',
    connectLabel: 'Connect Linear',
    freeTextAllowed: true,
    buildDiscoveryArgs: (input) => ({
      ...(input.query?.trim() ? { keywords: input.query.trim() } : {}),
      limit: input.limit ?? DEFAULT_LIMIT,
    }),
    normalize: normalizeLinearProjects,
  },
] as const

export function findEntityResolverDefinition(input: {
  toolName: string
  parameterName: string
}): EntityResolverDefinition | null {
  const { toolkit } = parseArcadeTool(input.toolName)
  return (
    ENTITY_RESOLVER_DEFINITIONS.find(
      (entry) => entry.toolkitName === toolkit && entry.parameterName === input.parameterName,
    ) ?? null
  )
}

export function resolveEntityResolverRef(input: {
  toolName: string
  parameterName: string
}): EntityResolverRef | null {
  const definition = findEntityResolverDefinition(input)
  if (!definition) return null
  return {
    id: definition.id,
    toolkitName: definition.toolkitName,
    loadingLabel: definition.loadingLabel,
    connectLabel: definition.connectLabel,
    freeTextAllowed: true,
    ...(definition.multiValue ? { multiValue: true } : {}),
  }
}

export function getEntityResolverDefinitionById(id: string): EntityResolverDefinition | null {
  return ENTITY_RESOLVER_DEFINITIONS.find((entry) => entry.id === id) ?? null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = asRecord(value)
  if (!record) return []
  for (const key of [
    'items',
    'results',
    'calendars',
    'conversations',
    'labels',
    'teams',
    'projects',
    'files',
    'folders',
    'data',
  ]) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate
  }
  return []
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

function option(value: string, label: string, hint?: string): EntityOption {
  return hint ? { value, label, hint } : { value, label }
}

function normalizeGoogleCalendars(output: unknown): EntityOption[] {
  const items = asArray(output)
  const options: EntityOption[] = []
  for (const item of items) {
    const record = asRecord(item)
    if (!record) continue
    const value = readString(record, ['id', 'calendar_id'])
    const label = readString(record, ['summary', 'name', 'title']) ?? value
    if (!value || !label) continue
    const hints: string[] = []
    if (record['primary'] === true) hints.push('Primary')
    const accessRole = readString(record, ['accessRole', 'access_role'])
    if (accessRole) hints.push(accessRole)
    options.push(option(value, label, hints.length > 0 ? hints.join(' · ') : undefined))
  }
  if (options.length === 0) {
    options.push(option('primary', 'Primary calendar', 'Default'))
  }
  return dedupeOptions(options)
}

function normalizeSlackConversations(output: unknown): EntityOption[] {
  const items = asArray(output)
  const options: EntityOption[] = []
  for (const item of items) {
    const record = asRecord(item)
    if (!record) continue
    const id = readString(record, ['id', 'conversation_id'])
    const name = readString(record, ['name', 'channel_name'])
    if (id) {
      options.push(option(id, name ? `#${name}` : id, 'Conversation ID'))
    }
    if (name) {
      options.push(option(name, `#${name}`, 'Channel name'))
    }
  }
  return dedupeOptions(options)
}

function normalizeGmailLabels(output: unknown): EntityOption[] {
  const items = asArray(output)
  const options: EntityOption[] = []
  for (const item of items) {
    const record = asRecord(item)
    if (!record) continue
    const name = readString(record, ['name', 'label'])
    const id = readString(record, ['id'])
    const value = name ?? id
    if (!value) continue
    options.push(option(value, name ?? value, id && name && id !== name ? id : undefined))
  }
  return dedupeOptions(options)
}

function normalizeGoogleDriveTree(output: unknown): EntityOption[] {
  const options: EntityOption[] = []
  walkDriveNodes(output, '', options)
  return dedupeOptions(options)
}

function walkDriveNodes(node: unknown, path: string, options: EntityOption[]): void {
  if (Array.isArray(node)) {
    for (const item of node) walkDriveNodes(item, path, options)
    return
  }
  const record = asRecord(node)
  if (!record) return

  const id = readString(record, ['id', 'file_id', 'folder_id'])
  const name = readString(record, ['name', 'title'])
  const mimeType = readString(record, ['mimeType', 'mime_type'])
  const isFolder =
    mimeType === 'application/vnd.google-apps.folder' ||
    record['is_folder'] === true ||
    record['type'] === 'folder'

  if (id && name && isFolder) {
    const nextPath = path ? `${path}/${name}` : name
    options.push(option(id, nextPath, 'Folder ID'))
    options.push(option(nextPath, nextPath, 'Folder path'))
  }

  for (const key of ['children', 'folders', 'files', 'items', 'tree']) {
    if (key in record)
      walkDriveNodes(
        record[key],
        name && isFolder ? (path ? `${path}/${name}` : name) : path,
        options,
      )
  }
}

function normalizeGoogleDriveSearch(output: unknown): EntityOption[] {
  const items = asArray(output)
  const options: EntityOption[] = []
  for (const item of items) {
    const record = asRecord(item)
    if (!record) continue
    const id = readString(record, ['id', 'file_id'])
    const name = readString(record, ['name', 'title'])
    const mimeType = readString(record, ['mimeType', 'mime_type'])
    if (!id || !name) continue
    const isFolder = mimeType === 'application/vnd.google-apps.folder'
    options.push(option(id, name, isFolder ? 'Folder' : 'File'))
  }
  return dedupeOptions(options)
}

function normalizeLinearTeams(output: unknown): EntityOption[] {
  const items = asArray(output)
  const options: EntityOption[] = []
  for (const item of items) {
    const record = asRecord(item)
    if (!record) continue
    const name = readString(record, ['name', 'team'])
    const key = readString(record, ['key'])
    const id = readString(record, ['id'])
    const value = name ?? key ?? id
    if (!value) continue
    const label = name ?? key ?? value
    const hint = key && key !== label ? key : undefined
    options.push(option(value, label, hint))
  }
  return dedupeOptions(options)
}

function normalizeLinearProjects(output: unknown): EntityOption[] {
  const items = asArray(output)
  const options: EntityOption[] = []
  for (const item of items) {
    const record = asRecord(item)
    if (!record) continue
    const name = readString(record, ['name', 'project'])
    const id = readString(record, ['id'])
    const value = name ?? id
    if (!value) continue
    options.push(option(value, name ?? value, id && name && id !== name ? id : undefined))
  }
  return dedupeOptions(options)
}

function dedupeOptions(options: EntityOption[]): EntityOption[] {
  const seen = new Set<string>()
  const out: EntityOption[] = []
  for (const entry of options) {
    const key = `${entry.value}\0${entry.label}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out
}

/** Extract Arcade tool execution output value for normalization. */
export function extractArcadeToolOutputValue(result: unknown): unknown {
  const record = asRecord(result)
  if (!record) return result
  const output = asRecord(record['output'])
  if (!output) return record['value'] ?? result
  if ('value' in output) return output['value']
  if ('error' in output) return output['error']
  return output
}

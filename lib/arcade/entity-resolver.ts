import {
  type EntityDiscoveryInput,
  type EntityOption,
  extractArcadeToolOutputValue,
  findEntityResolverDefinition,
  getEntityResolverDefinitionById,
} from '@/lib/display/entity-resolvers'
import { isArcadeMocked } from '@/lib/env'
import { executeArcadeTool } from './tools'

const CACHE_TTL_MS = 5 * 60_000

export type EntityResolveStatus = 'ok' | 'auth_required' | 'empty' | 'error'

export interface EntityResolveResult {
  status: EntityResolveStatus
  toolkitName: string
  options: EntityOption[]
  message?: string
}

const cache = new Map<
  string,
  {
    expiresAt: number
    result: EntityResolveResult
  }
>()

const inflight = new Map<string, Promise<EntityResolveResult>>()

const MOCK_OPTIONS: Record<string, EntityOption[]> = {
  'google-calendar-calendar-id': [
    { value: 'primary', label: 'Primary calendar', hint: 'Primary' },
    { value: 'work@example.com', label: 'Work', hint: 'Owner' },
  ],
  'slack-channel-name': [
    { value: 'sales-team', label: '#sales-team', hint: 'Channel name' },
    { value: 'general', label: '#general', hint: 'Channel name' },
  ],
  'slack-conversation-id': [
    { value: 'C0123456789', label: '#sales-team', hint: 'Conversation ID' },
  ],
  'gmail-labels-to-add': [
    { value: 'INBOX', label: 'INBOX' },
    { value: 'STARRED', label: 'STARRED' },
  ],
  'gmail-labels-to-remove': [
    { value: 'INBOX', label: 'INBOX' },
    { value: 'UNREAD', label: 'UNREAD' },
  ],
  'google-drive-parent-folder': [{ value: 'root', label: 'My Drive', hint: 'Folder ID' }],
  'google-drive-destination-folder': [{ value: 'root', label: 'My Drive', hint: 'Folder ID' }],
  'google-drive-folder-path': [{ value: 'root', label: 'My Drive', hint: 'Folder' }],
  'linear-team': [{ value: 'Engineering', label: 'Engineering', hint: 'ENG' }],
  'linear-project': [{ value: 'Launch Q2', label: 'Launch Q2' }],
}

export async function resolveEntityOptions(input: {
  toolName: string
  parameterName: string
  arcadeUserId: string | null
  connected: boolean
  discovery?: EntityDiscoveryInput
  force?: boolean
}): Promise<EntityResolveResult> {
  const definition = findEntityResolverDefinition({
    toolName: input.toolName,
    parameterName: input.parameterName,
  })
  if (!definition) {
    return {
      status: 'error',
      toolkitName: '',
      options: [],
      message: 'Unknown entity resolver',
    }
  }

  if (!input.connected || !input.arcadeUserId) {
    return {
      status: 'auth_required',
      toolkitName: definition.toolkitName,
      options: [],
    }
  }

  if (isArcadeMocked) {
    const options = MOCK_OPTIONS[definition.id] ?? []
    return {
      status: options.length > 0 ? 'ok' : 'empty',
      toolkitName: definition.toolkitName,
      options,
    }
  }

  const cacheKey = buildCacheKey({
    resolverId: definition.id,
    arcadeUserId: input.arcadeUserId,
    ...(input.discovery ? { discovery: input.discovery } : {}),
  })

  if (!input.force) {
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.result
  }

  const pending = inflight.get(cacheKey)
  if (pending) return pending

  const promise = fetchEntityOptions(definition.id, {
    arcadeUserId: input.arcadeUserId,
    ...(input.discovery ? { discovery: input.discovery } : {}),
  })
  inflight.set(cacheKey, promise)

  try {
    const result = await promise
    cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  } finally {
    inflight.delete(cacheKey)
  }
}

async function fetchEntityOptions(
  resolverId: string,
  input: {
    arcadeUserId: string
    discovery?: EntityDiscoveryInput
  },
): Promise<EntityResolveResult> {
  const definition = getEntityResolverDefinitionById(resolverId)
  if (!definition) {
    return {
      status: 'error',
      toolkitName: '',
      options: [],
      message: 'Unknown entity resolver',
    }
  }

  try {
    const discoveryArgs = definition.buildDiscoveryArgs(input.discovery ?? {})
    const result = await executeArcadeTool({
      tool: definition.discoveryTool,
      args: discoveryArgs,
      userId: input.arcadeUserId,
    })

    if (result.success === false || result.output?.error) {
      const message = formatArcadeError(result.output)
      if (looksLikeAuthFailure(message)) {
        return {
          status: 'auth_required',
          toolkitName: definition.toolkitName,
          options: [],
          message,
        }
      }
      return {
        status: 'error',
        toolkitName: definition.toolkitName,
        options: [],
        message,
      }
    }

    const raw = extractArcadeToolOutputValue(result)
    const options = definition.normalize(raw)
    return {
      status: options.length > 0 ? 'ok' : 'empty',
      toolkitName: definition.toolkitName,
      options,
      ...(options.length === 0 ? { message: 'No items returned from discovery tool.' } : {}),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discovery failed'
    if (looksLikeAuthFailure(message)) {
      return {
        status: 'auth_required',
        toolkitName: definition.toolkitName,
        options: [],
        message,
      }
    }
    return {
      status: 'error',
      toolkitName: definition.toolkitName,
      options: [],
      message,
    }
  }
}

function buildCacheKey(input: {
  resolverId: string
  arcadeUserId: string
  discovery?: EntityDiscoveryInput
}): string {
  const query = input.discovery?.query?.trim() ?? ''
  const limit = input.discovery?.limit ?? ''
  return `${input.resolverId}:${input.arcadeUserId}:${query}:${limit}`
}

function looksLikeAuthFailure(message: string): boolean {
  return /403|401|authorization required|not authorized|auth required/i.test(message)
}

function formatArcadeError(output: unknown): string {
  const record =
    output && typeof output === 'object' && !Array.isArray(output)
      ? (output as Record<string, unknown>)
      : null
  const error = record?.['error']
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return 'Discovery tool failed'
}

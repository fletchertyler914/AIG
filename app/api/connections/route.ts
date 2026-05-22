import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { listConfiguredProviderIds } from '@/lib/arcade/auth-providers'
import { authorizeToolkit } from '@/lib/arcade/authorize'
import {
  getArcadeToolkitCatalogEntry,
  getCatalogCacheMeta,
  listArcadeToolkitCatalogForConnections,
} from '@/lib/arcade/catalog'
import { arcadeIdentityForScope, toArcadeUserId } from '@/lib/arcade/identity'
import { canManageSharedConnections, resolveWorkspaceContext } from '@/lib/auth/session'
import { listToolkitConnectionsForUser, upsertToolkitConnection } from '@/lib/db/connection-queries'
import type { ConnectionAuthStatus, ToolkitConnection } from '@/lib/db/schema'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const refreshSchema = z.object({
  toolkitName: z.string().min(1),
  scope: z.enum(['personal', 'shared']).default('personal'),
  /** Post-OAuth redirect; must be same-origin under BETTER_AUTH_URL /app/*. */
  returnTo: z.string().optional(),
})

const scopeSchema = z.enum(['personal', 'shared'])

export type ConnectionScope = z.infer<typeof scopeSchema>

export interface ConnectionDto {
  toolkitName: string
  toolkitDescription: string | null
  categories: string[]
  representativeTool: string
  toolCount: number
  scope: ConnectionScope
  enabled: boolean
  authStatus: ConnectionAuthStatus
  authUrl: string | null
  providerId: string | null
  arcadeUserId: string | null
  ownerUserId: string | null
  connectedAt: number | null
  lastCheckedAt: number | null
}

export async function GET(request: Request) {
  try {
    const ctx = await resolveWorkspaceContext()
    const url = new URL(request.url)
    const force = url.searchParams.get('refresh') === '1'
    const query = url.searchParams.get('q')?.trim() ?? ''

    const identity = arcadeIdentityForScope({
      scope: 'personal',
      userId: ctx.userId,
      workspaceId: ctx.workspace.id,
    })
    const arcadeUserId = toArcadeUserId(identity)
    const { entries: catalog, indexTotal } = await listArcadeToolkitCatalogForConnections({
      arcadeUserId,
      query,
      force,
    })

    const cacheMeta = getCatalogCacheMeta(arcadeUserId)

    const { personal: personalRows, shared: sharedRows } = await listToolkitConnectionsForUser({
      workspaceId: ctx.workspace.id,
      userId: ctx.userId,
    })

    const personalByName = new Map(personalRows.map((row) => [row.toolkitName, row]))
    const sharedByName = new Map(sharedRows.map((row) => [row.toolkitName, row]))
    const configuredProviderIds = await listConfiguredProviderIds({ force })

    return jsonOk({
      workspace: {
        id: ctx.workspace.id,
        name: ctx.workspace.name,
        kind: ctx.workspace.kind,
      },
      canManageShared: canManageSharedConnections(ctx.memberRole),
      configuredProviderIds,
      catalogFetchedAt: cacheMeta.fetchedAt,
      indexTotal,
      searchQuery: query || null,
      personal: catalog.map((entry) => toDto(entry, 'personal', personalByName.get(entry.name))),
      shared: catalog.map((entry) => toDto(entry, 'shared', sharedByName.get(entry.name))),
    })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

export async function POST(request: Request) {
  try {
    const body = parseJson(refreshSchema, await request.json())
    const ctx = await resolveWorkspaceContext()

    if (body.scope === 'shared' && !canManageSharedConnections(ctx.memberRole)) {
      return jsonError('Only workspace owners and admins can connect shared toolkits', 403)
    }

    const identity = arcadeIdentityForScope({
      scope: body.scope,
      userId: ctx.userId,
      workspaceId: ctx.workspace.id,
    })
    const arcadeUserId = toArcadeUserId(identity)

    const entry = await getArcadeToolkitCatalogEntry({
      arcadeUserId,
      toolkitName: body.toolkitName,
    })
    if (!entry) return jsonError(`Unknown Arcade toolkit: ${body.toolkitName}`, 404)

    const auth = await authorizeToolkit({
      toolkitName: entry.name,
      representativeTool: entry.representativeTool,
      identity,
      nextUri: safeReturnTo(body.returnTo),
    })

    const connection = await upsertToolkitConnection({
      workspaceId: ctx.workspace.id,
      catalogEntry: entry,
      scope: body.scope,
      ownerUserId: body.scope === 'personal' ? ctx.userId : null,
      enabled: true,
      authStatus: auth.status,
      authUrl: auth.url ?? null,
      providerId: auth.providerId ?? null,
      arcadeUserId,
      pendingFlowId: auth.pendingFlowId ?? null,
      connectedAt: auth.status === 'completed' ? Date.now() : null,
    })

    return jsonOk({ connection: toDto(entry, body.scope, connection) })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

function safeReturnTo(returnTo: string | undefined): string {
  const fallback = `${env.BETTER_AUTH_URL}/app/connections`
  if (!returnTo) return fallback

  try {
    const base = new URL(env.BETTER_AUTH_URL)
    const url = new URL(returnTo, base)
    if (url.origin !== base.origin || !url.pathname.startsWith('/app/')) {
      return fallback
    }
    return url.toString()
  } catch {
    return fallback
  }
}

function toDto(
  entry: {
    name: string
    description: string | null
    categories: string[]
    representativeTool: string
    toolCount: number
  },
  scope: ConnectionScope,
  connection?: ToolkitConnection,
): ConnectionDto {
  return {
    toolkitName: entry.name,
    toolkitDescription: connection?.toolkitDescription ?? entry.description,
    categories: entry.categories,
    representativeTool: connection?.representativeTool ?? entry.representativeTool,
    toolCount: connection?.toolCount ?? entry.toolCount,
    scope,
    enabled: connection?.enabled ?? false,
    authStatus: connection?.authStatus ?? 'unknown',
    authUrl: connection?.authUrl ?? null,
    providerId: connection?.providerId ?? null,
    arcadeUserId: connection?.arcadeUserId ?? null,
    ownerUserId: connection?.ownerUserId ?? null,
    connectedAt: connection?.connectedAt ?? null,
    lastCheckedAt: connection?.lastCheckedAt ?? null,
  }
}

export { scopeSchema }

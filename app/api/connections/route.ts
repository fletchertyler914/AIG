import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { listConfiguredProviderIds } from '@/lib/arcade/auth-providers'
import { authorizeToolkit } from '@/lib/arcade/authorize'
import {
  getArcadeToolkitCatalogEntry,
  getCatalogCacheMeta,
  listArcadeToolkitCatalogForConnections,
} from '@/lib/arcade/catalog'
import {
  arcadeIdentityForScope,
  sharedArcadeIdentitySupported,
  toArcadeUserId,
} from '@/lib/arcade/identity'
import { canManageSharedConnections, resolveWorkspaceContext } from '@/lib/auth/session'
import {
  listToolkitConnectionsForUser,
  markConnectionCompleted,
  touchConnectionLastChecked,
  upsertToolkitConnection,
} from '@/lib/db/connection-queries'
import type { ConnectionAuthStatus, ToolkitConnection } from '@/lib/db/schema'
import { resolveOAuthReturnTo } from '@/lib/display/oauth-return'
import { getArcadeVerifierMode, getPublicAppOrigin } from '@/lib/env'
import { logger } from '@/lib/logger'

const log = logger.child({ route: '/api/connections' })

/**
 * Re-check Arcade for any connection rows that aren't yet `completed`. Arcade's
 * tools.authorize is idempotent — if the user already finished OAuth in another
 * tab, this picks it up and flips the DB row to `completed`.
 *
 * `failed` rows are skipped — the user must explicitly retry.
 */
async function syncPendingConnections(input: {
  workspaceId: string
  fallbackUserId: string
  email: string
  rows: ToolkitConnection[]
}): Promise<ToolkitConnection[]> {
  const needsCheck = input.rows.filter(
    (row): row is ToolkitConnection & { representativeTool: string } =>
      row.authStatus !== 'completed' &&
      row.authStatus !== 'failed' &&
      typeof row.representativeTool === 'string' &&
      row.representativeTool.length > 0,
  )
  if (needsCheck.length === 0) return input.rows

  const updates = await Promise.all(
    needsCheck.map(async (row) => {
      try {
        const identity = arcadeIdentityForScope({
          scope: row.scope,
          userId: row.ownerUserId ?? input.fallbackUserId,
          workspaceId: input.workspaceId,
          email: input.email,
        })
        const auth = await authorizeToolkit({
          toolkitName: row.toolkitName,
          representativeTool: row.representativeTool,
          identity,
        })
        if (auth.status === 'completed') {
          const updated = await markConnectionCompleted(row.id, {
            arcadeUserId: toArcadeUserId(identity),
          })
          return [row.id, updated ?? row] as const
        }
        await touchConnectionLastChecked(row.id)
        return [row.id, row] as const
      } catch (error) {
        log.warn({ err: error, toolkit: row.toolkitName }, 'connection auth re-check failed')
        return [row.id, row] as const
      }
    }),
  )

  const byId = new Map(updates)
  return input.rows.map((row) => byId.get(row.id) ?? row)
}

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
      email: ctx.email,
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

    const [syncedPersonal, syncedShared] = await Promise.all([
      syncPendingConnections({
        workspaceId: ctx.workspace.id,
        fallbackUserId: ctx.userId,
        email: ctx.email,
        rows: personalRows,
      }),
      syncPendingConnections({
        workspaceId: ctx.workspace.id,
        fallbackUserId: ctx.userId,
        email: ctx.email,
        rows: sharedRows,
      }),
    ])

    const personalByName = new Map(syncedPersonal.map((row) => [row.toolkitName, row]))
    const sharedByName = new Map(syncedShared.map((row) => [row.toolkitName, row]))
    const configuredProviderIds = await listConfiguredProviderIds({ force })

    return jsonOk({
      workspace: {
        id: ctx.workspace.id,
        name: ctx.workspace.name,
        kind: ctx.workspace.kind,
      },
      verifierMode: getArcadeVerifierMode(),
      sharedConnectionsSupported: sharedArcadeIdentitySupported(),
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

    if (body.scope === 'shared' && !sharedArcadeIdentitySupported()) {
      return jsonError(
        'Shared toolkit connections require custom verifier mode (production). Use personal connections in local dev.',
        422,
      )
    }

    const identity = arcadeIdentityForScope({
      scope: body.scope,
      userId: ctx.userId,
      workspaceId: ctx.workspace.id,
      email: ctx.email,
    })
    const arcadeUserId = toArcadeUserId(identity)

    const entry = await getArcadeToolkitCatalogEntry({
      arcadeUserId,
      toolkitName: body.toolkitName,
    })
    if (!entry) return jsonError(`Unknown Arcade toolkit: ${body.toolkitName}`, 404)

    const returnDestination = resolveOAuthReturnTo({
      appOrigin: getPublicAppOrigin(),
      returnTo: body.returnTo,
    })

    const auth = await authorizeToolkit({
      toolkitName: entry.name,
      representativeTool: entry.representativeTool,
      identity,
    })

    const connection = await upsertToolkitConnection({
      workspaceId: ctx.workspace.id,
      catalogEntry: entry,
      scope: body.scope,
      ownerUserId: body.scope === 'personal' ? ctx.userId : null,
      operatorEmail: ctx.email,
      enabled: true,
      authStatus: auth.status,
      authUrl: auth.url ?? null,
      providerId: auth.providerId ?? null,
      arcadeUserId,
      pendingFlowId: auth.pendingFlowId ?? null,
      oauthReturnTo: returnDestination,
      connectedAt: auth.status === 'completed' ? Date.now() : null,
    })

    return jsonOk({ connection: toDto(entry, body.scope, connection) })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
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

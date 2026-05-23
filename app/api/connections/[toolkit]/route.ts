import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { authorizeToolkit, revokeUserConnection } from '@/lib/arcade/authorize'
import { getArcadeToolkitCatalogEntry } from '@/lib/arcade/catalog'
import {
  arcadeIdentityForScope,
  parseFlowIdFromAuthUrl,
  toArcadeUserId,
} from '@/lib/arcade/identity'
import { canManageSharedConnections, resolveWorkspaceContext } from '@/lib/auth/session'
import {
  getToolkitConnection,
  listToolkitConnections,
  markConnectionAuthorization,
  resetConnectionAfterRevoke,
  setToolkitConnectionEnabled,
  upsertToolkitConnection,
} from '@/lib/db/connection-queries'
import type { ToolkitConnection } from '@/lib/db/schema'
import { inferProviderIdFromToolkit } from '@/lib/display/auth-providers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = logger.child({ route: '/api/connections/[toolkit]' })

const scopeParam = z.enum(['personal', 'shared']).default('personal')

const patchSchema = z.object({
  enabled: z.boolean(),
  scope: scopeParam,
})

interface RouteContext {
  params: Promise<{ toolkit: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = parseJson(patchSchema, await request.json())
    const { toolkit } = await context.params
    const toolkitName = decodeURIComponent(toolkit)
    const ctx = await resolveWorkspaceContext()

    const existing = await setToolkitConnectionEnabled({
      workspaceId: ctx.workspace.id,
      toolkitName,
      scope: body.scope,
      ownerUserId: body.scope === 'personal' ? ctx.userId : null,
      enabled: body.enabled,
    })

    if (existing) return jsonOk({ connection: existing })

    const identity = arcadeIdentityForScope({
      scope: body.scope,
      userId: ctx.userId,
      workspaceId: ctx.workspace.id,
      email: ctx.email,
    })
    const catalogEntry = await getArcadeToolkitCatalogEntry({
      arcadeUserId: toArcadeUserId(identity),
      toolkitName,
    })
    if (!catalogEntry) return jsonError(`Unknown Arcade toolkit: ${toolkitName}`, 404)

    const created = await upsertToolkitConnection({
      workspaceId: ctx.workspace.id,
      catalogEntry,
      scope: body.scope,
      ownerUserId: body.scope === 'personal' ? ctx.userId : null,
      operatorEmail: ctx.email,
      enabled: body.enabled,
      authStatus: 'unknown',
    })

    return jsonOk({ connection: created })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

function connectionProviderId(connection: ToolkitConnection): string | null {
  return connection.providerId ?? inferProviderIdFromToolkit(connection.toolkitName)
}

function providerFamily(providerId: string | null): string | null {
  return providerId?.startsWith('arcade-') ? providerId.slice('arcade-'.length) : providerId
}

function sameOwnerAndScope(input: {
  row: ToolkitConnection
  scope: 'personal' | 'shared'
  userId: string
}): boolean {
  return (
    input.row.scope === input.scope &&
    (input.scope === 'shared' || input.row.ownerUserId === input.userId)
  )
}

/**
 * Remove one toolkit's access. OAuth providers do not support subtracting a
 * single scope from an existing token, so we revoke the provider grant and then
 * immediately start re-authorization for the remaining same-provider toolkits.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { toolkit } = await context.params
    const toolkitName = decodeURIComponent(toolkit)
    const url = new URL(request.url)
    const scope = scopeParam.parse(url.searchParams.get('scope') ?? 'personal')
    const ctx = await resolveWorkspaceContext()

    if (scope === 'shared' && !canManageSharedConnections(ctx.memberRole)) {
      return jsonError('Only workspace owners and admins can disconnect shared toolkits', 403)
    }

    const row = await getToolkitConnection({
      workspaceId: ctx.workspace.id,
      toolkitName,
      scope,
      ...(scope === 'personal' ? { ownerUserId: ctx.userId } : {}),
    })

    if (!row) {
      return jsonOk({ connection: null, revoked: false })
    }

    const providerId = connectionProviderId(row)
    const providerFamilyId = providerFamily(providerId)
    let revoked = false
    let reauthorizeUrl: string | null = null
    const reauthorizeToolkits: string[] = []

    const identity = arcadeIdentityForScope({
      scope,
      userId: ctx.userId,
      workspaceId: ctx.workspace.id,
      email: ctx.email,
    })
    if (providerId) {
      try {
        const result = await revokeUserConnection({ identity, providerId })
        revoked = result.revoked
      } catch (error) {
        log.warn({ err: error, toolkitName, providerId }, 'arcade revoke failed')
      }
    }

    const updated = await resetConnectionAfterRevoke(row.id)

    // Rebuild the provider grant for remaining rows in this provider family.
    // This keeps removal scoped to the clicked toolkit instead of marking the
    // whole provider family as disconnected.
    if (revoked && providerId) {
      const all = await listToolkitConnections(ctx.workspace.id)
      const siblings = all.filter(
        (r): r is ToolkitConnection & { representativeTool: string } =>
          r.id !== row.id &&
          sameOwnerAndScope({ row: r, scope, userId: ctx.userId }) &&
          providerFamily(connectionProviderId(r)) === providerFamilyId &&
          r.authStatus === 'completed' &&
          typeof r.representativeTool === 'string' &&
          r.representativeTool.length > 0,
      )
      for (const sibling of siblings) {
        try {
          const auth = await authorizeToolkit({
            toolkitName: sibling.toolkitName,
            representativeTool: sibling.representativeTool,
            identity,
          })
          reauthorizeToolkits.push(sibling.toolkitName)
          if (!reauthorizeUrl && auth.url) reauthorizeUrl = auth.url
          await markConnectionAuthorization({
            connectionId: sibling.id,
            authStatus: auth.status,
            authUrl: auth.url ?? null,
            providerId: auth.providerId ?? providerId,
            pendingFlowId:
              auth.pendingFlowId ?? (auth.url ? parseFlowIdFromAuthUrl(auth.url) : null),
            connectedAt: auth.status === 'completed' ? Date.now() : null,
          })
        } catch (error) {
          log.warn(
            { err: error, toolkitName: sibling.toolkitName, providerId },
            'remaining toolkit reauthorization failed',
          )
          await markConnectionAuthorization({
            connectionId: sibling.id,
            authStatus: 'pending',
            authUrl: null,
            providerId,
            pendingFlowId: null,
            connectedAt: null,
          })
        }
      }
    }

    return jsonOk({
      connection: updated,
      revoked,
      providerId,
      reauthorizeUrl,
      reauthorizeToolkits,
    })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

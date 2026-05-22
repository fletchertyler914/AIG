import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { getArcadeToolkitCatalogEntry } from '@/lib/arcade/catalog'
import { arcadeIdentityForScope, toArcadeUserId } from '@/lib/arcade/identity'
import { resolveWorkspaceContext } from '@/lib/auth/session'
import { setToolkitConnectionEnabled, upsertToolkitConnection } from '@/lib/db/connection-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const patchSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(['personal', 'shared']).default('personal'),
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
      enabled: body.enabled,
      authStatus: 'unknown',
    })

    return jsonOk({ connection: created })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

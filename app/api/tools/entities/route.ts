import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { resolveEntityOptions } from '@/lib/arcade/entity-resolver'
import { resolveArcadeUserIdForConnection } from '@/lib/arcade/identity'
import { resolveWorkspaceContext } from '@/lib/auth/session'
import { resolveConnectionForTool } from '@/lib/db/connection-queries'
import { findEntityResolverDefinition } from '@/lib/display/entity-resolvers'
import { parseArcadeTool } from '@/lib/display/toolkits'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const bodySchema = z.object({
  toolName: z.string().min(1).max(300),
  parameterName: z.string().min(1).max(120),
  query: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  refresh: z.boolean().optional(),
})

export async function POST(request: Request) {
  try {
    const body = parseJson(bodySchema, await request.json())
    const definition = findEntityResolverDefinition({
      toolName: body.toolName,
      parameterName: body.parameterName,
    })
    if (!definition) {
      return jsonError(`No entity resolver for ${body.toolName} :: ${body.parameterName}`, 404)
    }

    const ctx = await resolveWorkspaceContext()
    const { toolkit } = parseArcadeTool(body.toolName)
    const connection = await resolveConnectionForTool({
      workspaceId: ctx.workspace.id,
      approverUserId: ctx.userId === 'anonymous' ? '' : ctx.userId,
      toolkitName: toolkit,
    })

    const connected = connection?.authStatus === 'completed'
    const arcadeUserId =
      connection && ctx.userId !== 'anonymous' && ctx.email
        ? resolveArcadeUserIdForConnection({
            connection: {
              scope: connection.scope,
              ownerUserId: connection.ownerUserId,
            },
            operator: {
              userId: ctx.userId,
              email: ctx.email,
              workspaceId: ctx.workspace.id,
            },
          })
        : (connection?.arcadeUserId ?? null)

    const result = await resolveEntityOptions({
      toolName: body.toolName,
      parameterName: body.parameterName,
      arcadeUserId,
      connected,
      force: body.refresh ?? false,
      discovery: {
        ...(body.query !== undefined ? { query: body.query } : {}),
        ...(body.limit !== undefined ? { limit: body.limit } : {}),
      },
    })

    return jsonOk(result)
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

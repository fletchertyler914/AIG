import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown } from '@/lib/api/http'
import { personalArcadeIdentity, toArcadeUserId } from '@/lib/arcade/identity'
import { listArcadeToolIndex, searchTools, type ToolIndexEntry } from '@/lib/arcade/tool-index'
import { resolveWorkspaceContext } from '@/lib/auth/session'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const querySchema = z.object({
  q: z.string().max(200).optional(),
  mode: z.enum(['tool', 'toolkit']).default('tool'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  refresh: z.enum(['0', '1']).optional(),
})

export async function GET(request: Request) {
  try {
    const ctx = await resolveWorkspaceContext()
    const url = new URL(request.url)
    const query = querySchema.parse(Object.fromEntries(url.searchParams))
    const identity = personalArcadeIdentity(
      ctx.userId === 'anonymous' ? 'demo' : ctx.userId,
      ctx.email || env.DEMO_USER_ID,
    )
    const arcadeUserId = toArcadeUserId(identity)
    const entries = await listArcadeToolIndex({
      arcadeUserId,
      force: query.refresh === '1',
      signal: request.signal,
    })
    const tools = searchTools({
      entries,
      mode: query.mode,
      limit: query.limit,
      ...(query.q !== undefined ? { query: query.q } : {}),
    })

    return jsonOk({
      query: query.q?.trim() || null,
      mode: query.mode,
      tools: tools.map(toDto),
      totalAvailable: entries.length,
    })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

function toDto(tool: ToolIndexEntry): ToolIndexEntry {
  return {
    name: tool.name,
    qualifiedName: tool.qualifiedName,
    actionName: tool.actionName,
    toolkitName: tool.toolkitName,
    toolkitDisplayName: tool.toolkitDisplayName,
    actionDisplayName: tool.actionDisplayName,
    description: tool.description,
    toolkitDescription: tool.toolkitDescription,
    version: tool.version,
    requiresAuth: tool.requiresAuth,
    categories: tool.categories,
  }
}

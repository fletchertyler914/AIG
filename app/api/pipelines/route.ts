import { z } from 'zod'
import type { PipelineTemplate } from '@/lib/aig/pipeline'
import { buildPipelineTemplate, canPromoteIntentStatus } from '@/lib/aig/pipeline'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { resolveWorkspaceContext } from '@/lib/auth/session'
import { createPipeline, listPipelinesForWorkspace } from '@/lib/db/pipeline-queries'
import { getIntentWithTrace } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const promoteSchema = z.object({
  intentId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
})

export interface PipelineDto {
  id: string
  name: string
  description: string | null
  version: number
  objective: string
  systems: string[]
  sourceIntentId: string | null
  toolCount: number
  createdAt: number
  updatedAt: number
}

export async function GET() {
  try {
    const ctx = await resolveWorkspaceContext()
    const rows = await listPipelinesForWorkspace(ctx.workspace.id)
    return jsonOk({
      workspace: { id: ctx.workspace.id, name: ctx.workspace.name },
      pipelines: rows.map(toDto),
    })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

export async function POST(request: Request) {
  try {
    const body = parseJson(promoteSchema, await request.json())
    const ctx = await resolveWorkspaceContext()

    const trace = await getIntentWithTrace(body.intentId)
    if (!trace || trace.intent.workspaceId !== ctx.workspace.id) {
      return jsonError('Intent not found', 404)
    }

    if (!canPromoteIntentStatus(trace.intent.status)) {
      return jsonError(
        `Intent must be COMPLETE, PENDING_REVIEW, APPROVED, or EXECUTING to promote (got ${trace.intent.status})`,
        422,
      )
    }

    const template = buildPipelineTemplate({
      label: trace.intent.label,
      description: trace.intent.description,
      objective: trace.intent.objective,
      systems: trace.intent.systems,
      confidence: trace.intent.confidence ? Number(trace.intent.confidence) : null,
      toolCalls: trace.toolCalls.map((tc) => ({
        id: tc.id,
        tool: tc.tool,
        args: tc.args,
        dependsOn: tc.dependsOn,
        position: tc.position,
        rollbackPolicy: tc.rollbackPolicy,
      })),
    })

    const pipeline = await createPipeline({
      workspaceId: ctx.workspace.id,
      name: body.name ?? trace.intent.label,
      description: body.description ?? trace.intent.description,
      sourceIntentId: trace.intent.id,
      objective: trace.intent.objective,
      systems: trace.intent.systems,
      template,
      createdByUserId: ctx.userId === 'anonymous' ? null : ctx.userId,
    })

    return jsonOk({ pipeline: toDto(pipeline) })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

function toDto(row: {
  id: string
  name: string
  description: string | null
  version: number
  objective: string
  systems: string[]
  sourceIntentId: string | null
  template: unknown
  createdAt: number
  updatedAt: number
}): PipelineDto {
  const template = row.template as PipelineTemplate
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    objective: row.objective,
    systems: row.systems,
    sourceIntentId: row.sourceIntentId,
    toolCount: template.toolCalls?.length ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export { promoteSchema }

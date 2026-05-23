import { ulid } from 'ulid'
import { impactSummaryForCalls, statusForConfidence } from '@/lib/aig/formation'
import type { PipelineTemplate } from '@/lib/aig/pipeline'
import type { IntentStatus } from '@/lib/aig/types'
import { jsonError, jsonOk, messageFromUnknown } from '@/lib/api/http'
import { authorizeMany, hasPendingAuthorizations } from '@/lib/arcade/authorize'
import { personalArcadeIdentity } from '@/lib/arcade/identity'
import { resolveWorkspaceContext } from '@/lib/auth/session'
import { getPipelineById } from '@/lib/db/pipeline-queries'
import { createIntent } from '@/lib/db/queries'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Instantiate a new intent run from a saved pipeline template.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const ctx = await resolveWorkspaceContext()
    const pipeline = await getPipelineById({ workspaceId: ctx.workspace.id, pipelineId: id })
    if (!pipeline) return jsonError('Pipeline not found', 404)

    const template = pipeline.template as PipelineTemplate
    const arcadeIdentity = personalArcadeIdentity(
      ctx.userId === 'anonymous' ? 'demo' : ctx.userId,
      ctx.email || env.DEMO_USER_ID,
    )

    const authorizations = await authorizeMany(
      template.toolCalls.map((c) => c.tool),
      arcadeIdentity,
    )
    const pendingAuths = authorizations.filter((a) => a.status !== 'completed')

    const initialStatus: IntentStatus = hasPendingAuthorizations(authorizations)
      ? 'UNCERTAIN'
      : statusForConfidence(template.confidence ?? 1)

    const impact: Record<string, unknown> = {
      ...impactSummaryForCalls(
        template.toolCalls.map((c) => ({
          tool: c.tool,
          args: c.args,
          windowId: `pipeline:${pipeline.id}`,
          capturedAt: Date.now(),
        })),
      ),
      pipelineId: pipeline.id,
      pipelineVersion: pipeline.version,
      ...(pendingAuths.length > 0 ? { pendingAuthorizations: pendingAuths } : {}),
      ...(ctx.email ? { arcadeOperatorEmail: ctx.email } : {}),
    }

    const { intentId } = await createIntent({
      workspaceId: ctx.workspace.id,
      createdByUserId: ctx.userId === 'anonymous' ? null : ctx.userId,
      label: template.label,
      description: template.description,
      objective: template.objective,
      windowId: ulid(),
      systems: template.systems,
      impact,
      confidence: template.confidence,
      expireAtMs: Date.now() + 5 * 60_000,
      initialStatus,
      toolCalls: template.toolCalls.map((tc) => ({
        tool: tc.tool,
        args: tc.args,
        dependsOn: tc.dependsOn,
        position: tc.position,
        ...(tc.rollbackPolicy ? { rollbackPolicy: tc.rollbackPolicy } : {}),
      })),
      proposedBy: 'agent',
    })

    return jsonOk({ intentId })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

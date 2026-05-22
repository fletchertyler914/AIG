import { z } from 'zod'
import { createLlmLabeler } from '@/lib/ai/labeler'
import { runPlanAgent } from '@/lib/ai/plan-agent'
import { formCandidateIntent, statusForConfidence } from '@/lib/aig/formation'
import type { IntentStatus } from '@/lib/aig/types'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { authorizeMany, hasPendingAuthorizations } from '@/lib/arcade/authorize'
import { type CreateIntentInput, createIntent, listRecentIntents } from '@/lib/db/queries'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = logger.child({ route: 'POST /api/intents' })

const createIntentSchema = z.object({
  prompt: z.string().min(1).max(2000),
  userId: z.string().email().optional(),
  /** Toolkits the plan agent may consider. Default mirrors the operator's
   *  Arcade authorizations for the demo scenario. */
  toolkits: z.array(z.string().min(1)).min(1).optional(),
  maxSteps: z.number().int().min(1).max(16).optional(),
})

const DEFAULT_TOOLKITS = ['Gmail', 'GoogleCalendar'] as const

export async function GET() {
  const intents = await listRecentIntents()
  return jsonOk({ intents })
}

export async function POST(request: Request) {
  try {
    const body = parseJson(createIntentSchema, await request.json())
    const userId = body.userId ?? env.DEMO_USER_ID
    const toolkits = body.toolkits ?? [...DEFAULT_TOOLKITS]

    log.info({ userId, toolkits, promptChars: body.prompt.length }, 'plan agent invoked')

    const plan = await runPlanAgent({
      prompt: body.prompt,
      userId,
      toolkits,
      ...(body.maxSteps !== undefined ? { maxSteps: body.maxSteps } : {}),
    })

    if (plan.calls.length === 0) {
      return jsonError(
        'Plan agent returned no tool calls. Try a more concrete prompt (who, what system, what action).',
        422,
      )
    }

    const labeler = createLlmLabeler({ userPrompt: body.prompt })
    const candidate = await formCandidateIntent({ calls: plan.calls, labeler })

    const authorizations = await authorizeMany(
      candidate.toolCalls.map((c) => c.tool),
      userId,
    )

    const initialStatus: IntentStatus = hasPendingAuthorizations(authorizations)
      ? 'UNCERTAIN'
      : statusForConfidence(candidate.confidence)

    const pendingAuths = authorizations.filter((a) => a.status !== 'completed')

    const input: CreateIntentInput = {
      label: candidate.label,
      description: candidate.description,
      objective: candidate.objective,
      windowId: plan.windowId,
      systems: candidate.systems,
      impact: {
        ...candidate.impact,
        ...(pendingAuths.length > 0 ? { pendingAuthorizations: pendingAuths } : {}),
        ...(plan.text ? { agentSummary: plan.text } : {}),
      },
      confidence: candidate.confidence,
      expireAtMs: Date.now() + 5 * 60_000,
      initialStatus,
      toolCalls: candidate.toolCalls,
      proposedBy: 'agent',
    }

    const result = await createIntent(input)
    log.info({ intentId: result.intentId, status: initialStatus }, 'intent created')
    return jsonOk(result, { status: 201 })
  } catch (error) {
    log.error({ err: error }, 'failed to create intent')
    return jsonError(messageFromUnknown(error), 400)
  }
}

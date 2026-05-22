import { buildDemoIntentInput } from '@/lib/api/demo-intent'
import { jsonError, jsonOk, messageFromUnknown } from '@/lib/api/http'
import { createIntent } from '@/lib/db/queries'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = logger.child({ route: 'POST /api/intents/demo' })

/**
 * Deterministic fast-path for reviewers: bypasses the plan agent and
 * Arcade authorization round-trip, returns the canned lead-followup
 * intent immediately. The repair loop and execution path are unchanged.
 */
export async function POST() {
  try {
    const input = await buildDemoIntentInput()
    const result = await createIntent(input)
    log.info({ intentId: result.intentId }, 'demo intent created (fast-path)')
    return jsonOk(result, { status: 201 })
  } catch (error) {
    log.error({ err: error }, 'failed to create demo intent')
    return jsonError(messageFromUnknown(error), 400)
  }
}

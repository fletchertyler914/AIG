import { z } from 'zod'
import { buildDemoIntentInput } from '@/lib/api/demo-intent'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { createIntent, listRecentIntents } from '@/lib/db/queries'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const createIntentSchema = z.object({
  prompt: z.string().min(1).optional(),
  userId: z.string().email().optional(),
})

export async function GET() {
  const intents = await listRecentIntents()
  return jsonOk({ intents })
}

export async function POST(request: Request) {
  try {
    parseJson(createIntentSchema, await request.json())

    // Phase 3 vertical slice: deterministic demo plan. Phase 4 swaps this for
    // the plan agent using Arcade-formatted tool definitions.
    const input = await buildDemoIntentInput()
    const result = await createIntent(input)

    return jsonOk(result, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'failed to create intent')
    return jsonError(messageFromUnknown(error), 400)
  }
}

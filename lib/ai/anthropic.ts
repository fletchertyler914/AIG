import { createAnthropic } from '@ai-sdk/anthropic'
import { env } from '@/lib/env'

/**
 * Anthropic provider singleton for AI SDK 6.
 *
 * Only imported from `lib/ai/*` and `lib/aig/repair.ts` (via plan-agent).
 */
export const anthropic = createAnthropic({
  apiKey: env.ANTHROPIC_API_KEY,
})

/** Default model for plan + repair. Sonnet balances speed and quality for the demo loop. */
export const CLAUDE_SONNET = anthropic('claude-sonnet-4-5-20250929')

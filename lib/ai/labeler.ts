/**
 * LLM-backed intent labeler.
 *
 * Consumed by `formCandidateIntent({ labeler })` after the plan agent
 * has captured a window of tool calls. Produces the label, description,
 * locked objective, and dependency refinements.
 *
 * Like the repair engine, every call is a fresh LLM session — no
 * conversation history is threaded through.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { IntentLabeler, LabelResult } from '@/lib/aig/formation'

const PROMPT_DIR = dirname(fileURLToPath(import.meta.url))
const SYSTEM_PROMPT = readFileSync(
  join(PROMPT_DIR, '..', 'aig', 'prompts', 'labeler.system.md'),
  'utf8',
)

const labelerResponseSchema = z.object({
  label: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  objective: z.string().min(1).max(400),
  dependencies: z.array(
    z.object({
      position: z.number().int().nonnegative(),
      dependsOn: z.array(z.string()),
    }),
  ),
})

export type LabelerResponse = z.infer<typeof labelerResponseSchema>

export interface LlmLabelerOptions {
  /** Test-only injection. If set, no LLM call is made. */
  mockResponse?: LabelerResponse
  /** Optional user-supplied prompt that motivated the plan; included as
   *  context so the labeler can produce a faithful objective. */
  userPrompt?: string
}

/**
 * Create an `IntentLabeler` callback for use with `formCandidateIntent`.
 */
export function createLlmLabeler(options: LlmLabelerOptions = {}): IntentLabeler {
  return async ({ calls, systems }): Promise<LabelResult> => {
    if (options.mockResponse) {
      return options.mockResponse
    }

    const payload = {
      userPrompt: options.userPrompt ?? null,
      systems,
      calls: calls.map((c, idx) => ({
        position: idx,
        tool: c.tool,
        args: c.args,
      })),
    }

    const { CLAUDE_SONNET } = await import('./anthropic')
    const { object } = await generateObject({
      model: CLAUDE_SONNET,
      schema: labelerResponseSchema,
      system: SYSTEM_PROMPT,
      prompt: JSON.stringify(payload, null, 2),
      temperature: 0,
    })

    return object
  }
}

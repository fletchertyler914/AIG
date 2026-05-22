/**
 * AIG Plan Agent.
 *
 * Runs Claude with Arcade tools available, but every tool `execute` is
 * short-circuited: instead of calling Arcade, it captures the tool name
 * and args. The full plan is returned for the formation engine.
 *
 * Each run uses a fresh `windowId` so reasoning-window boundaries stay
 * deterministic — see ADR-0001 and `lib/aig/formation.ts`.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateText, jsonSchema, stepCountIs, type ToolSet, tool } from 'ai'
import { ulid } from 'ulid'
import type { CapturedToolCall } from '@/lib/aig/types'
import { getArcadeClient } from '@/lib/arcade/client'
import { logger } from '@/lib/logger'

const PROMPT_DIR = dirname(fileURLToPath(import.meta.url))
const SYSTEM_PROMPT = readFileSync(
  join(PROMPT_DIR, '..', 'aig', 'prompts', 'plan-agent.system.md'),
  'utf8',
)

const log = logger.child({ module: 'plan-agent' })

/**
 * Shape Arcade returns when `format: 'anthropic'`. The Arcade types
 * declare an opaque map, so we narrow defensively at runtime.
 */
interface AnthropicToolDef {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

export interface PlanAgentMockOptions {
  calls: ReadonlyArray<{ tool: string; args: Record<string, unknown> }>
  text?: string
}

export interface PlanAgentInput {
  prompt: string
  userId: string
  toolkits: ReadonlyArray<string>
  /** Hard cap on agent steps. Default 8. */
  maxSteps?: number
  /** When set, the LLM is not called and these calls are returned. */
  mock?: PlanAgentMockOptions
}

export interface PlanAgentResult {
  windowId: string
  calls: CapturedToolCall[]
  /** The agent's one-sentence summary, if any. */
  text: string
}

const NAME_SAFE = /[^a-zA-Z0-9_-]/g

function sanitizeToolName(name: string): string {
  return name.replace(NAME_SAFE, '_')
}

function isAnthropicToolDef(value: unknown): value is AnthropicToolDef {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v['name'] === 'string' && typeof v['input_schema'] === 'object'
}

/**
 * Run the plan agent. Returns the captured tool calls in emit order
 * along with the agent's text summary.
 *
 * Throws if Arcade is unreachable, Claude errors, or no toolkits are
 * authorized.
 */
export async function runPlanAgent(input: PlanAgentInput): Promise<PlanAgentResult> {
  const windowId = ulid()
  const calls: CapturedToolCall[] = []

  if (input.mock) {
    let seq = 0
    for (const c of input.mock.calls) {
      calls.push({
        windowId,
        tool: c.tool,
        args: c.args,
        capturedAt: Date.now() + seq++,
      })
    }
    return { windowId, calls, text: input.mock.text ?? '' }
  }

  const arcade = getArcadeClient()
  const aiTools: ToolSet = {}
  const seenTools = new Set<string>()

  for (const toolkit of input.toolkits) {
    const page = await arcade.tools.formatted.list({
      format: 'anthropic',
      user_id: input.userId,
      toolkit,
      limit: 100,
    })

    for (const raw of page.items as unknown as unknown[]) {
      if (!isAnthropicToolDef(raw)) continue
      const safeName = sanitizeToolName(raw.name)
      if (seenTools.has(safeName)) continue
      seenTools.add(safeName)

      aiTools[safeName] = tool({
        description: raw.description ?? '',
        inputSchema: jsonSchema<Record<string, unknown>>(raw.input_schema),
        execute: async (args: Record<string, unknown>) => {
          calls.push({
            windowId,
            tool: raw.name,
            args: args ?? {},
            capturedAt: Date.now(),
          })
          return { captured: true, mode: 'plan_only' as const }
        },
      })
    }
  }

  if (Object.keys(aiTools).length === 0) {
    throw new Error(
      `No Arcade tools available for user ${input.userId} in toolkits [${input.toolkits.join(', ')}]. ` +
        'Visit app.arcade.dev to authorize the toolkits this plan agent expects.',
    )
  }

  log.info(
    { tools: Object.keys(aiTools).length, toolkits: input.toolkits, userId: input.userId },
    'running plan agent',
  )

  const { CLAUDE_SONNET } = await import('./anthropic')
  const result = await generateText({
    model: CLAUDE_SONNET,
    system: SYSTEM_PROMPT,
    prompt: input.prompt,
    tools: aiTools,
    stopWhen: stepCountIs(input.maxSteps ?? 8),
    temperature: 0,
  })

  log.info(
    { capturedCalls: calls.length, finishReason: result.finishReason },
    'plan agent finished',
  )

  return { windowId, calls, text: result.text }
}

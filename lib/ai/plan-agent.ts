/**
 * AIG Plan Agent.
 *
 * Runs Claude with Arcade tools available, but every tool `execute` is
 * short-circuited: instead of calling Arcade, it captures the tool name
 * and args. The full plan is returned for the formation engine.
 *
 * Two Arcade endpoints are used:
 *   - `tools.formatted.list({ format: 'anthropic' })` — Anthropic-shaped
 *     tool definitions with underscored names and JSON schemas.
 *   - `tools.list()` — canonical `Toolkit.Tool@version` names. We build a
 *     mapping `anthropic_name → fully_qualified_name` so captured calls
 *     reference exactly the version Arcade will execute later.
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
const SYSTEM_PROMPT_TEMPLATE = readFileSync(
  join(PROMPT_DIR, '..', 'aig', 'prompts', 'plan-agent.system.md'),
  'utf8',
)

const log = logger.child({ module: 'plan-agent' })

/** Shape Arcade returns when `format: 'anthropic'`. */
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
  /** Hard cap on agent steps. Default 6. */
  maxSteps?: number
  /** Optional abort signal to cancel a long-running plan. */
  signal?: AbortSignal
  /** Override "today" in the system prompt — tests inject this for determinism. */
  now?: Date
  /** When set, the LLM is not called and these calls are returned. */
  mock?: PlanAgentMockOptions
}

export interface PlanAgentResult {
  windowId: string
  calls: CapturedToolCall[]
  /** The agent's one-sentence summary, if any. */
  text: string
  /** Diagnostics surfaced for the UI / observability stack. */
  diagnostics: {
    toolkitsRequested: ReadonlyArray<string>
    toolsExposed: number
    finishReason: string | null
    promptTokens?: number
    completionTokens?: number
  }
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

interface CanonicalIndexEntry {
  fullyQualifiedName: string
  qualifiedName: string
  toolkit: string
}

/**
 * Build a mapping from anthropic-format tool name (e.g. "Gmail_SendEmail")
 * to canonical Arcade fully-qualified name (e.g. "Gmail.SendEmail@7.0.0").
 *
 * The Anthropic name is derived by replacing non-alphanumeric chars with
 * underscores, so we sanitize the canonical qualified_name the same way
 * and use that as the index key.
 */
async function buildCanonicalIndex(
  toolkits: ReadonlyArray<string>,
  userId: string,
  signal?: AbortSignal,
): Promise<Map<string, CanonicalIndexEntry>> {
  const arcade = getArcadeClient()
  const index = new Map<string, CanonicalIndexEntry>()

  for (const toolkit of toolkits) {
    const page = await arcade.tools.list(
      { user_id: userId, toolkit, limit: 100 },
      signal ? { signal } : undefined,
    )
    for (const t of page.items) {
      const key = sanitizeToolName(t.qualified_name)
      index.set(key, {
        fullyQualifiedName: t.fully_qualified_name,
        qualifiedName: t.qualified_name,
        toolkit: t.toolkit.name,
      })
    }
  }

  return index
}

function renderSystemPrompt(now: Date, operatorEmail: string): string {
  const iso = now.toISOString()
  const today = iso.slice(0, 10)
  const year = today.slice(0, 4)
  return SYSTEM_PROMPT_TEMPLATE.replaceAll('{{TODAY}}', today)
    .replaceAll('{{YEAR}}', year)
    .replaceAll('{{ISO_NOW}}', iso)
    .replaceAll('{{OPERATOR_EMAIL}}', operatorEmail)
}

/**
 * Run the plan agent. Returns the captured tool calls in emit order
 * along with the agent's text summary.
 */
export async function runPlanAgent(input: PlanAgentInput): Promise<PlanAgentResult> {
  const windowId = ulid()
  const calls: CapturedToolCall[] = []
  const now = input.now ?? new Date()

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
    return {
      windowId,
      calls,
      text: input.mock.text ?? '',
      diagnostics: {
        toolkitsRequested: input.toolkits,
        toolsExposed: 0,
        finishReason: 'mock',
      },
    }
  }

  const arcade = getArcadeClient()
  const aiTools: ToolSet = {}
  const seenTools = new Set<string>()
  const unresolved = new Set<string>()

  const canonical = await buildCanonicalIndex(input.toolkits, input.userId, input.signal)

  for (const toolkit of input.toolkits) {
    const page = await arcade.tools.formatted.list(
      {
        format: 'anthropic',
        user_id: input.userId,
        toolkit,
        limit: 100,
      },
      input.signal ? { signal: input.signal } : undefined,
    )

    for (const raw of page.items as unknown as unknown[]) {
      if (!isAnthropicToolDef(raw)) continue
      const anthropicName = raw.name
      const safeName = sanitizeToolName(anthropicName)
      if (seenTools.has(safeName)) continue
      seenTools.add(safeName)

      const mapped = canonical.get(safeName)
      if (!mapped) {
        unresolved.add(anthropicName)
        continue
      }

      aiTools[safeName] = tool({
        description: raw.description ?? '',
        inputSchema: jsonSchema<Record<string, unknown>>(raw.input_schema),
        execute: async (args: Record<string, unknown>) => {
          calls.push({
            windowId,
            tool: mapped.fullyQualifiedName,
            args: args ?? {},
            capturedAt: Date.now(),
          })
          return { captured: true as const, mode: 'plan_only' as const }
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

  if (unresolved.size > 0) {
    log.warn(
      { unresolved: Array.from(unresolved) },
      'some anthropic tool names did not map to a canonical Arcade tool — excluded',
    )
  }

  log.info(
    { tools: Object.keys(aiTools).length, toolkits: input.toolkits, userId: input.userId },
    'running plan agent',
  )

  const { CLAUDE_SONNET } = await import('./anthropic')
  const result = await generateText({
    model: CLAUDE_SONNET,
    system: renderSystemPrompt(now, input.userId),
    prompt: input.prompt,
    tools: aiTools,
    stopWhen: stepCountIs(input.maxSteps ?? 6),
    temperature: 0,
    ...(input.signal ? { abortSignal: input.signal } : {}),
  })

  log.info(
    { capturedCalls: calls.length, finishReason: result.finishReason },
    'plan agent finished',
  )

  return {
    windowId,
    calls,
    text: result.text,
    diagnostics: {
      toolkitsRequested: input.toolkits,
      toolsExposed: Object.keys(aiTools).length,
      finishReason: result.finishReason ?? null,
      ...(result.usage?.inputTokens !== undefined
        ? { promptTokens: result.usage.inputTokens }
        : {}),
      ...(result.usage?.outputTokens !== undefined
        ? { completionTokens: result.usage.outputTokens }
        : {}),
    },
  }
}

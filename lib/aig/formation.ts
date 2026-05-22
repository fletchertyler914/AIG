/**
 * Intent formation engine.
 *
 * PURE module. Given a list of captured tool calls in a single reasoning
 * window plus an injected `intentLabeler` callback, produces a candidate
 * intent shape ready to persist via `lib/db/queries.createIntent`.
 *
 * Why pure: this module is the heart of the deterministic logic that backs
 * the regeneration loop. Anything non-deterministic (LLM calls, IDs, time)
 * is injected as a parameter so tests can pin them.
 */

import type { CapturedToolCall, ImpactSummary } from './types'

// ── System extraction ────────────────────────────────────────────────────────

/**
 * Arcade tool names are dot-delimited, e.g. "Google.SendEmail" or
 * "Slack.SendMessageToChannel". The first segment is the toolkit / system.
 */
export function systemForTool(tool: string): string {
  const dot = tool.indexOf('.')
  return dot === -1 ? tool : tool.slice(0, dot)
}

export function systemsForCalls(calls: ReadonlyArray<CapturedToolCall>): string[] {
  const set = new Set<string>()
  for (const call of calls) set.add(systemForTool(call.tool))
  return Array.from(set).sort()
}

// ── Impact summary ───────────────────────────────────────────────────────────

export function impactSummaryForCalls(calls: ReadonlyArray<CapturedToolCall>): ImpactSummary {
  const bySystem: Record<string, number> = {}
  for (const call of calls) {
    const system = systemForTool(call.tool)
    bySystem[system] = (bySystem[system] ?? 0) + 1
  }
  return { bySystem, totalCalls: calls.length }
}

// ── Entity extraction ────────────────────────────────────────────────────────

const EMAIL_RX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const URL_RX = /https?:\/\/[^\s"'<>]+/g

/**
 * Walks any JSON-ish value collecting candidate entity identifiers — emails,
 * URLs, and string values that look like stable IDs (any string containing
 * an `@` or running >12 chars without spaces).
 */
export function extractEntities(value: unknown): Set<string> {
  const out = new Set<string>()
  walk(value, out)
  return out
}

function walk(value: unknown, into: Set<string>): void {
  if (value === null || value === undefined) return
  if (typeof value === 'string') {
    const emails = value.match(EMAIL_RX)
    if (emails) for (const e of emails) into.add(e.toLowerCase())
    const urls = value.match(URL_RX)
    if (urls) for (const u of urls) into.add(u)
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) walk(v, into)
    return
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) walk(v, into)
  }
}

// ── Confidence ───────────────────────────────────────────────────────────────

/**
 * A simple deterministic confidence in [0..1] for "do these calls belong
 * together as one intent?"
 *
 * Inputs:
 *   - shared entities across calls (higher = better)
 *   - temporal proximity (all in the same reasoning window → strong prior)
 *   - system diversity (multi-system intents are intentional, not noise)
 *
 * Below 0.6 the intent is marked UNCERTAIN in the formation pipeline.
 */
export function computeConfidence(calls: ReadonlyArray<CapturedToolCall>): number {
  if (calls.length <= 1) return 1.0

  const entitySets = calls.map((c) => extractEntities(c.args))
  const overlapping = entitySets.filter((s) => s.size > 0)
  if (overlapping.length === 0) return 0.55 // weak, but they share a window

  // Pairwise Jaccard.
  let pairs = 0
  let totalSim = 0
  for (let i = 0; i < overlapping.length; i++) {
    for (let j = i + 1; j < overlapping.length; j++) {
      const a = overlapping[i] as Set<string>
      const b = overlapping[j] as Set<string>
      const intersection = new Set([...a].filter((x) => b.has(x))).size
      const union = new Set([...a, ...b]).size
      if (union === 0) continue
      totalSim += intersection / union
      pairs += 1
    }
  }

  const avg = pairs === 0 ? 0 : totalSim / pairs
  const windowBonus = 0.5
  return Math.max(0, Math.min(1, avg * 0.5 + windowBonus))
}

// ── Heuristic dependency inference ───────────────────────────────────────────

/**
 * A coarse heuristic to seed the dependency graph before the LLM labeller
 * refines it. Returns positional dependencies (e.g. "@0", "@1") suitable for
 * `createIntent`.
 *
 * Rule: if a later call references an entity (email/URL) that ONLY appears
 * in an earlier call's args, the later call depends on the earlier one.
 *
 * This is intentionally conservative — false positives cost regeneration
 * cycles, false negatives are silently fine because the LLM refinement step
 * has the final say.
 */
export function heuristicDependencies(
  calls: ReadonlyArray<CapturedToolCall>,
): Array<{ position: number; dependsOn: string[] }> {
  const entitySets = calls.map((c) => extractEntities(c.args))
  return calls.map((_, idx) => {
    const dependsOn = new Set<string>()
    const own = entitySets[idx] as Set<string>
    for (let j = 0; j < idx; j++) {
      const earlier = entitySets[j] as Set<string>
      for (const entity of earlier) {
        if (own.has(entity)) {
          dependsOn.add(`@${j}`)
          break
        }
      }
    }
    return { position: idx, dependsOn: Array.from(dependsOn) }
  })
}

// ── Candidate intent assembly ────────────────────────────────────────────────

export interface CandidateIntent {
  label: string
  description: string
  objective: string
  systems: string[]
  impact: ImpactSummary
  confidence: number
  toolCalls: Array<{
    tool: string
    args: Record<string, unknown>
    dependsOn: string[]
    position: number
  }>
}

export interface FormationInput {
  calls: ReadonlyArray<CapturedToolCall>
  /** Injected LLM step. */
  labeler: IntentLabeler
}

export type IntentLabeler = (input: {
  calls: ReadonlyArray<CapturedToolCall>
  systems: string[]
}) => Promise<LabelResult>

export interface LabelResult {
  label: string
  description: string
  /** Will be locked in the intent after FORMED. */
  objective: string
  /**
   * Optional dependency refinements from the model. Positions match the
   * positional order of the input calls.
   */
  dependencies?: Array<{ position: number; dependsOn: string[] }>
}

/**
 * Assemble a CandidateIntent from a windowful of captured tool calls.
 * Combines heuristic dependency inference with optional LLM refinement.
 */
export async function formCandidateIntent({
  calls,
  labeler,
}: FormationInput): Promise<CandidateIntent> {
  if (calls.length === 0) {
    throw new Error('cannot form an intent from zero tool calls')
  }

  const systems = systemsForCalls(calls)
  const impact = impactSummaryForCalls(calls)
  const heuristicDeps = heuristicDependencies(calls)
  const confidence = computeConfidence(calls)

  const { label, description, objective, dependencies } = await labeler({ calls, systems })

  const depsByPosition = new Map<number, string[]>()
  for (const d of heuristicDeps) depsByPosition.set(d.position, d.dependsOn)
  if (dependencies) {
    for (const d of dependencies) depsByPosition.set(d.position, d.dependsOn)
  }

  const toolCalls = calls.map((call, idx) => ({
    tool: call.tool,
    args: call.args,
    dependsOn: depsByPosition.get(idx) ?? [],
    position: idx,
  }))

  return {
    label,
    description,
    objective,
    systems,
    impact,
    confidence,
    toolCalls,
  }
}

/**
 * Used by the API route to decide whether to start an intent in
 * `PENDING_REVIEW` or `UNCERTAIN`.
 */
export const CONFIDENCE_GATE = 0.6

export function statusForConfidence(confidence: number): 'PENDING_REVIEW' | 'UNCERTAIN' {
  return confidence >= CONFIDENCE_GATE ? 'PENDING_REVIEW' : 'UNCERTAIN'
}

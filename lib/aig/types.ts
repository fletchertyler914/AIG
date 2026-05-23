/**
 * Domain types for AIG.
 *
 * Lifted from `lib/db/schema.ts` where they originate, with a handful of
 * additional discriminated unions for the pure-domain modules.
 *
 * IMPORTANT: this file must remain importable from `lib/aig/*` without
 * pulling in any DB driver, network, or filesystem code. Do not add side
 * effects here.
 */

import { z } from 'zod'

// ── Status enums (string literal unions, must match the schema enums) ────────

export const INTENT_STATUSES = [
  'DRAFT',
  'UNCERTAIN',
  'FORMED',
  'PENDING_REVIEW',
  'MODIFIED',
  'REGENERATING',
  'APPROVED',
  'EXECUTING',
  'COMPLETE',
  'PARTIAL_FAILURE',
  'FAILED',
  'BLOCKED',
  'EXPIRED',
] as const

export type IntentStatus = (typeof INTENT_STATUSES)[number]

export const TOOL_CALL_STATUSES = [
  'pending',
  'approved',
  'executing',
  'done',
  'failed',
  'invalidated',
] as const

export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number]

export const MUTATION_TYPES = [
  'agent_proposed',
  'agent_regenerated',
  'system_invalidated',
  'system_expired',
  'human_added',
  'human_removed',
  'human_edited',
  'human_approved',
  'human_blocked',
  'arcade_executed',
  'arcade_failed',
] as const

export type MutationType = (typeof MUTATION_TYPES)[number]

export type MutationActor = 'agent' | 'human' | 'system'

export type RollbackPolicy = 'HALT_REMAINING' | 'COMPENSATE'

// ── Domain shapes ────────────────────────────────────────────────────────────

/**
 * A captured tool call BEFORE intent formation — comes off the plan agent's
 * stream. Pure data, no DB id yet.
 */
export interface CapturedToolCall {
  windowId: string
  tool: string
  args: Record<string, unknown>
  capturedAt: number
}

/**
 * An impact summary surfaced in the UI's "what is about to happen" panel.
 * Strictly deterministic — no risk scoring, no probabilistic estimates.
 */
export interface ImpactSummary {
  bySystem: Record<string, number>
  totalCalls: number
}

export const impactSummarySchema = z.object({
  bySystem: z.record(z.string(), z.number().int().nonnegative()),
  totalCalls: z.number().int().nonnegative(),
})

// ── Repair contract ──────────────────────────────────────────────────────────

/**
 * Minimal node shape consumed by the repair engine. Locking + dependency
 * graph is communicated explicitly — the model does not infer it.
 */
export interface RepairNode {
  id: string
  tool: string
  args: Record<string, unknown>
  /** Approved nodes carry locked: true and MUST appear in `preserve`. */
  locked: boolean
  /** Set to true if a human has edited the args. Repair must not modify them. */
  humanEdited: boolean
  dependsOn: string[]
}

export interface RepairInput {
  /** Locked at FORMED time. Repair must not rewrite. */
  objective: string
  objectiveLocked: true
  /** Nodes that are immutable (approved or done). */
  lockedNodes: RepairNode[]
  /** Nodes the human (or system) has invalidated. To be removed or replaced. */
  invalidatedNodes: RepairNode[]
  /** Pending nodes that are NOT in the invalidated set — keep them. */
  preservedNodes: RepairNode[]
  /** Reason the human cited for the mutation (if any). */
  humanReason?: string
}

/**
 * The repair engine's response shape. Validated by zod — invalid output
 * throws, never silently coerced.
 */
export const newRepairNodeSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  dependsOn: z.array(z.string()),
})

export type NewRepairNode = z.infer<typeof newRepairNodeSchema>

export const repairResponseSchema = z.object({
  /** Brand new tool calls to insert. Each must be a fresh ULID at write time. */
  replace: z.array(newRepairNodeSchema),
  /** IDs of existing tool calls to keep unchanged. MUST include every locked id. */
  preserve: z.array(z.string()),
  /** IDs of existing tool calls to drop. */
  remove: z.array(z.string()),
})

export type RepairResponse = z.infer<typeof repairResponseSchema>

// ── Errors ───────────────────────────────────────────────────────────────────

export class AIGInvalidTransitionError extends Error {
  constructor(
    public readonly from: IntentStatus,
    public readonly to: IntentStatus,
  ) {
    super(`Invalid intent transition: ${from} → ${to}`)
    this.name = 'AIGInvalidTransitionError'
  }
}

export class AIGCycleError extends Error {
  constructor() {
    super('Cycle detected in tool call dependency graph')
    this.name = 'AIGCycleError'
  }
}

export class AIGRepairContractError extends Error {
  constructor(reason: string) {
    super(`Repair response violated contract: ${reason}`)
    this.name = 'AIGRepairContractError'
  }
}

export class AIGBlockedAuthError extends Error {
  constructor(
    public readonly approver: string,
    public readonly tokenOwner: string,
  ) {
    super(`Auth mismatch: approver (${approver}) !== token owner (${tokenOwner})`)
    this.name = 'AIGBlockedAuthError'
  }
}

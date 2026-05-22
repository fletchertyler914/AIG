/**
 * Typed Drizzle queries — the ONLY place that talks to the database.
 *
 * All functions return promises and operate inside transactions where state
 * consistency matters (state machine transitions, dependent invalidations,
 * mutation appends).
 */

import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { assertTransition } from '@/lib/aig/state'
import type {
  IntentStatus,
  MutationActor,
  MutationType,
  RollbackPolicy,
  ToolCallStatus,
} from '@/lib/aig/types'
import { db } from '@/lib/db/client'
import {
  executionRecords,
  type Intent,
  intents,
  type Mutation,
  mutations,
  type NewExecutionRecord,
  type ToolCall,
  toolCalls,
} from '@/lib/db/schema'

// ── Reads ────────────────────────────────────────────────────────────────────

export interface IntentWithTrace {
  intent: Intent
  toolCalls: ToolCall[]
  mutations: Mutation[]
}

export async function getIntentWithTrace(intentId: string): Promise<IntentWithTrace | null> {
  const [intent] = await db.select().from(intents).where(eq(intents.id, intentId)).limit(1)
  if (!intent) return null

  const [tcs, muts] = await Promise.all([
    db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.intentId, intentId))
      .orderBy(asc(toolCalls.position), asc(toolCalls.createdAt)),
    db
      .select()
      .from(mutations)
      .where(eq(mutations.intentId, intentId))
      .orderBy(asc(mutations.mutationIndex)),
  ])

  return { intent, toolCalls: tcs, mutations: muts }
}

export async function listRecentIntents(limit = 25): Promise<Intent[]> {
  return db.select().from(intents).orderBy(sql`${intents.createdAt} desc`).limit(limit)
}

// ── Creation ─────────────────────────────────────────────────────────────────

export interface CreateIntentInput {
  label: string
  description: string
  objective: string
  windowId: string
  systems: string[]
  impact: Record<string, unknown>
  confidence: number | null
  expireAtMs: number
  initialStatus: IntentStatus
  toolCalls: Array<{
    tool: string
    args: Record<string, unknown>
    dependsOn: string[]
    position: number
    rollbackPolicy?: RollbackPolicy
  }>
  /** Becomes the first row in the co-authorship trace. */
  proposedBy: 'agent'
}

export interface CreateIntentResult {
  intentId: string
  toolCallIds: string[]
}

/**
 * Transactional intent + tool calls + first `agent_proposed` mutation.
 *
 * Maps incoming dependsOn references (by *position*) to the actual tool call
 * ULIDs we generate here.
 */
export async function createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
  return db.transaction(async (tx) => {
    const intentId = ulid()

    await tx.insert(intents).values({
      id: intentId,
      label: input.label,
      description: input.description,
      objective: input.objective,
      objectiveLocked: true,
      status: input.initialStatus,
      windowId: input.windowId,
      systems: input.systems,
      impact: input.impact,
      confidence: input.confidence !== null ? String(input.confidence) : null,
      expireAt: input.expireAtMs,
    })

    // First pass: assign ULIDs by position so dependsOn references resolve.
    const idsByPosition = new Map<number, string>()
    for (const tc of input.toolCalls) {
      idsByPosition.set(tc.position, ulid())
    }

    const rows = input.toolCalls.map((tc) => {
      const id = idsByPosition.get(tc.position)
      if (!id) throw new Error(`invariant: missing id for position ${tc.position}`)
      const dependsOnIds = tc.dependsOn.map((ref) => {
        // If `ref` matches an existing ULID-style id, use directly; else
        // assume it's a positional pointer ("@0", "@1"...).
        if (ref.startsWith('@')) {
          const pos = Number(ref.slice(1))
          const mapped = idsByPosition.get(pos)
          if (!mapped) throw new Error(`invariant: unknown dependsOn position ${ref}`)
          return mapped
        }
        return ref
      })
      return {
        id,
        intentId,
        tool: tc.tool,
        args: tc.args,
        dependsOn: dependsOnIds,
        position: tc.position,
        rollbackPolicy: tc.rollbackPolicy ?? ('HALT_REMAINING' as const),
      }
    })

    if (rows.length > 0) {
      await tx.insert(toolCalls).values(rows)
    }

    await tx.insert(mutations).values({
      id: ulid(),
      intentId,
      mutationIndex: 0,
      type: 'agent_proposed',
      actor: 'agent',
      payload: {
        toolCallCount: rows.length,
        systems: input.systems,
      },
    })

    return {
      intentId,
      toolCallIds: rows.map((r) => r.id),
    }
  })
}

// ── State transitions ───────────────────────────────────────────────────────

export async function setIntentStatus(
  intentId: string,
  next: IntentStatus,
): Promise<Intent | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: intents.status })
      .from(intents)
      .where(eq(intents.id, intentId))
      .limit(1)
    if (!current) return null

    assertTransition(current.status, next)

    const [updated] = await tx
      .update(intents)
      .set({ status: next })
      .where(eq(intents.id, intentId))
      .returning()
    return updated ?? null
  })
}

export async function markIntentApproved(
  intentId: string,
  approvedBy: string,
): Promise<Intent | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: intents.status })
      .from(intents)
      .where(eq(intents.id, intentId))
      .limit(1)
    if (!current) return null
    assertTransition(current.status, 'APPROVED')

    const now = Date.now()
    const [updated] = await tx
      .update(intents)
      .set({
        status: 'APPROVED',
        approvedBy,
        approvedAt: now,
      })
      .where(eq(intents.id, intentId))
      .returning()
    if (!updated) return null

    // Snapshot args + lock pending tool calls.
    await tx
      .update(toolCalls)
      .set({
        locked: true,
        argSnapshot: sql`${toolCalls.args}`,
        status: 'approved',
      })
      .where(and(eq(toolCalls.intentId, intentId), eq(toolCalls.status, 'pending')))

    return updated
  })
}

// ── Mutations (co-authorship trace) ─────────────────────────────────────────

interface AppendMutationInput {
  intentId: string
  type: MutationType
  actor: MutationActor
  payload?: Record<string, unknown>
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0]
}

type TxOrDb = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db

async function writeMutation(tx: TxOrDb, input: AppendMutationInput): Promise<Mutation> {
  const [{ nextIndex } = { nextIndex: 0 }] = await tx
    .select({
      nextIndex: sql<number>`coalesce(max(${mutations.mutationIndex}), -1) + 1`,
    })
    .from(mutations)
    .where(eq(mutations.intentId, input.intentId))

  const [row] = await tx
    .insert(mutations)
    .values({
      id: ulid(),
      intentId: input.intentId,
      mutationIndex: nextIndex,
      type: input.type,
      actor: input.actor,
      payload: input.payload ?? {},
    })
    .returning()
  if (!row) throw new Error('failed to insert mutation')
  return row
}

/**
 * Append-only — never UPDATE or DELETE rows here.
 * `mutationIndex` is computed inside the transaction to guarantee monotonicity.
 */
export async function appendMutation(input: AppendMutationInput): Promise<Mutation> {
  if (input.tx) return writeMutation(input.tx, input)
  return db.transaction((tx) => writeMutation(tx, input))
}

// ── Tool call mutations ─────────────────────────────────────────────────────

export async function invalidateToolCalls(intentId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db
    .update(toolCalls)
    .set({ status: 'invalidated' })
    .where(and(eq(toolCalls.intentId, intentId), inArray(toolCalls.id, ids)))
}

export async function editToolCallArgs(
  toolCallId: string,
  args: Record<string, unknown>,
): Promise<ToolCall | null> {
  const [row] = await db
    .update(toolCalls)
    .set({ args })
    .where(and(eq(toolCalls.id, toolCallId), eq(toolCalls.locked, false)))
    .returning()
  return row ?? null
}

export async function setToolCallStatus(
  toolCallId: string,
  next: ToolCallStatus,
): Promise<ToolCall | null> {
  const [row] = await db
    .update(toolCalls)
    .set({ status: next })
    .where(eq(toolCalls.id, toolCallId))
    .returning()
  return row ?? null
}

// ── Execution records ────────────────────────────────────────────────────────

export async function recordExecution(input: Omit<NewExecutionRecord, 'id'>): Promise<void> {
  await db.insert(executionRecords).values({ id: ulid(), ...input })
}

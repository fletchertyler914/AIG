/**
 * AIG Drizzle Schema — single source of truth for the database.
 *
 * Generate migrations with `pnpm db:generate`, apply with `pnpm db:migrate`
 * (or `pnpm db:push` for local dev iteration).
 *
 * Every state transition is reflected here:
 *   intents ───┬─< tool_calls
 *              ├─< mutations          (append-only co-authorship trace)
 *              └─< execution_records
 */

import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ── Enums ────────────────────────────────────────────────────────────────────

export const intentStatusEnum = pgEnum('intent_status', [
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
])

export const toolCallStatusEnum = pgEnum('tool_call_status', [
  'pending',
  'approved',
  'executing',
  'done',
  'failed',
  'invalidated',
])

export const mutationTypeEnum = pgEnum('mutation_type', [
  'agent_proposed',
  'agent_regenerated',
  'system_invalidated',
  'system_expired',
  'human_removed',
  'human_edited',
  'human_approved',
  'human_blocked',
  'arcade_executed',
  'arcade_failed',
])

export const mutationActorEnum = pgEnum('mutation_actor', ['agent', 'human', 'system'])

export const rollbackPolicyEnum = pgEnum('rollback_policy', ['HALT_REMAINING', 'COMPENSATE'])

// ── Tables ───────────────────────────────────────────────────────────────────

/**
 * An intent is a transactional grouping of tool calls with a locked objective.
 *
 * Created at FORMED time. Status transitions are validated by the state machine
 * in `lib/aig/state.ts` — never UPDATE this table without going through the
 * `setIntentStatus` query.
 */
export const intents = pgTable(
  'intents',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    description: text('description').notNull(),
    /** Set at FORMED time. Locked thereafter. The repair engine receives it
     *  but is contractually forbidden from rewriting it. */
    objective: text('objective').notNull(),
    objectiveLocked: boolean('objective_locked').notNull().default(true),

    status: intentStatusEnum('status').notNull().default('DRAFT'),

    /** Reasoning-window boundary. All tool calls captured in the same window
     *  belong to the same candidate transaction. Hard boundary — see ADR. */
    windowId: text('window_id').notNull(),

    /** Affected systems, e.g. ['Google', 'Slack']. Derived at formation time. */
    systems: text('systems').array().notNull().default(sql`'{}'::text[]`),

    /** Deterministic impact summary. Replaces the deprecated risk score. */
    impact: jsonb('impact').notNull().default(sql`'{}'::jsonb`),

    /** Confidence the grouping engine had when forming this intent. Below
     *  0.6 → status starts as UNCERTAIN, requiring human split/merge. */
    confidence: numeric('confidence', { precision: 3, scale: 2 }),

    /** Identity of the human who approved this intent. MUST equal the
     *  Arcade `user_id` passed to `tools.execute` — enforced at execution
     *  time, surfaced as AIGBlockedAuthError when violated. */
    approvedBy: text('approved_by'),
    approvedAt: bigint('approved_at', { mode: 'number' }),

    /** EXPIRED if `now() > expire_at` and not yet approved. */
    expireAt: bigint('expire_at', { mode: 'number' }).notNull(),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    index('intents_status_idx').on(t.status),
    index('intents_window_idx').on(t.windowId),
    index('intents_created_at_idx').on(t.createdAt),
  ],
)

export const toolCalls = pgTable(
  'tool_calls',
  {
    id: text('id').primaryKey(),
    intentId: text('intent_id')
      .notNull()
      .references(() => intents.id, { onDelete: 'cascade' }),

    /** Fully-qualified Arcade tool name, e.g. "Google.SendEmail". */
    tool: text('tool').notNull(),

    /** Live args. Editable until `locked = true`. */
    args: jsonb('args').notNull(),

    /** Immutable copy of args at approval time. */
    argSnapshot: jsonb('arg_snapshot'),

    status: toolCallStatusEnum('status').notNull().default('pending'),

    /** IDs of tool calls this one depends on. */
    dependsOn: text('depends_on').array().notNull().default(sql`'{}'::text[]`),

    rollbackPolicy: rollbackPolicyEnum('rollback_policy').notNull().default('HALT_REMAINING'),
    rollbackArgs: jsonb('rollback_args'),

    /** Arcade response payload after a successful execution. */
    execResult: jsonb('exec_result'),
    execError: text('exec_error'),

    /** Set TRUE once the parent intent reaches APPROVED. Immutable thereafter. */
    locked: boolean('locked').notNull().default(false),

    /** Display order in the detail view. */
    position: integer('position').notNull().default(0),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [index('tool_calls_intent_idx').on(t.intentId)],
)

/**
 * Append-only co-authorship trace.
 *
 * This is the primary UI surface — every row renders as one line in the
 * timeline. NEVER UPDATE or DELETE rows here.
 *
 * `mutationIndex` is monotonic per intent and used as the render order.
 */
export const mutations = pgTable(
  'mutations',
  {
    id: text('id').primaryKey(),
    intentId: text('intent_id')
      .notNull()
      .references(() => intents.id, { onDelete: 'cascade' }),
    mutationIndex: integer('mutation_index').notNull(),
    type: mutationTypeEnum('type').notNull(),
    actor: mutationActorEnum('actor').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    ts: bigint('ts', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    uniqueIndex('mutations_intent_index_uq').on(t.intentId, t.mutationIndex),
    index('mutations_intent_idx').on(t.intentId),
  ],
)

export const executionRecords = pgTable(
  'execution_records',
  {
    id: text('id').primaryKey(),
    intentId: text('intent_id')
      .notNull()
      .references(() => intents.id, { onDelete: 'cascade' }),
    toolCallId: text('tool_call_id')
      .notNull()
      .references(() => toolCalls.id, { onDelete: 'cascade' }),
    result: jsonb('result'),
    error: text('error'),
    success: boolean('success').notNull(),
    ts: bigint('ts', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [index('exec_intent_idx').on(t.intentId)],
)

// ── Inferred types ───────────────────────────────────────────────────────────

export type Intent = typeof intents.$inferSelect
export type NewIntent = typeof intents.$inferInsert

export type ToolCall = typeof toolCalls.$inferSelect
export type NewToolCall = typeof toolCalls.$inferInsert

export type Mutation = typeof mutations.$inferSelect
export type NewMutation = typeof mutations.$inferInsert

export type ExecutionRecord = typeof executionRecords.$inferSelect
export type NewExecutionRecord = typeof executionRecords.$inferInsert

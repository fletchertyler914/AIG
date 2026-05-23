/**
 * AIG Drizzle Schema — single source of truth for the database.
 *
 * Generate migrations with `pnpm db:generate`, apply with `pnpm db:migrate`
 * (or `pnpm db:push` for local dev iteration).
 *
 * Layered as:
 *   ── Identity & tenancy (managed by Better Auth, re-exported here) ──
 *     user, session, account, verification, organization, member, invitation
 *
 *   ── Tenancy extensions (owned by AIG) ──
 *     workspaces            ── execution boundaries inside an organization
 *     toolkit_connections   ── workspace-scoped Arcade toolkit preferences
 *
 *   ── Execution plane (the original intent graph) ──
 *     intents ───┬─< tool_calls
 *                ├─< mutations          (append-only co-authorship trace)
 *                └─< execution_records
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

// Re-export Better-Auth-managed tables so the drizzle adapter sees them and
// every consumer can import schema from one place.
export {
  account,
  accountRelations,
  invitation,
  invitationRelations,
  member,
  memberRelations,
  organization,
  organizationRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from '@/lib/db/auth-schema'

import { organization, user } from '@/lib/db/auth-schema'

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
  'human_added',
  'human_removed',
  'human_edited',
  'human_approved',
  'human_blocked',
  'arcade_executed',
  'arcade_failed',
])

export const mutationActorEnum = pgEnum('mutation_actor', ['agent', 'human', 'system'])

export const rollbackPolicyEnum = pgEnum('rollback_policy', ['HALT_REMAINING', 'COMPENSATE'])

export const workspaceKindEnum = pgEnum('workspace_kind', ['production', 'sandbox'])

export const connectionAuthStatusEnum = pgEnum('connection_auth_status', [
  'unknown',
  'not_started',
  'pending',
  'completed',
  'failed',
])

export const connectionScopeEnum = pgEnum('connection_scope', ['personal', 'shared'])

export const approvalPolicyActionEnum = pgEnum('approval_policy_action', [
  'require_admin_approval',
  'block',
])

export const policyDecisionOutcomeEnum = pgEnum('policy_decision_outcome', ['allowed', 'blocked'])

// ── Tenancy extensions ───────────────────────────────────────────────────────

/**
 * A workspace is the execution boundary inside an organization. Every intent,
 * connection, pipeline, and approval policy belongs to exactly one workspace.
 *
 * Organizations come from Better Auth (`organization` table). Workspaces are
 * AIG's own concept: one organization typically has a `production` workspace
 * and may also have a `sandbox` one for testing pipelines before pointing them
 * at real tools.
 */
export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    kind: workspaceKindEnum('kind').notNull().default('production'),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    uniqueIndex('workspaces_org_slug_uq').on(t.organizationId, t.slug),
    index('workspaces_org_idx').on(t.organizationId),
  ],
)

/**
 * Workspace-level preference over an Arcade toolkit.
 *
 * Arcade authorization remains per user + per underlying OAuth provider. This
 * table captures the control-plane decision: "this workspace may use Gmail",
 * plus the latest observed auth status for the active operator.
 */
export const toolkitConnections = pgTable(
  'toolkit_connections',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    toolkitName: text('toolkit_name').notNull(),
    toolkitDescription: text('toolkit_description'),
    representativeTool: text('representative_tool'),
    toolCount: integer('tool_count').notNull().default(0),
    scope: connectionScopeEnum('scope').notNull().default('personal'),
    /** Set for personal connections; NULL for shared workspace connections. */
    ownerUserId: text('owner_user_id').references(() => user.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    authStatus: connectionAuthStatusEnum('auth_status').notNull().default('unknown'),
    authUrl: text('auth_url'),
    providerId: text('provider_id'),
    /** Stable Arcade user_id (`user:…` or `workspace:…`). */
    arcadeUserId: text('arcade_user_id'),
    /** Latest OAuth flow id while authorization is pending. */
    pendingFlowId: text('pending_flow_id'),
    connectedAt: bigint('connected_at', { mode: 'number' }),
    lastCheckedAt: bigint('last_checked_at', { mode: 'number' }),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    uniqueIndex('toolkit_connections_personal_uq')
      .on(t.workspaceId, t.toolkitName, t.ownerUserId)
      .where(sql`${t.scope} = 'personal'`),
    uniqueIndex('toolkit_connections_shared_uq')
      .on(t.workspaceId, t.toolkitName)
      .where(sql`${t.scope} = 'shared'`),
    index('toolkit_connections_workspace_idx').on(t.workspaceId),
    index('toolkit_connections_enabled_idx').on(t.workspaceId, t.enabled),
    index('toolkit_connections_pending_flow_idx').on(t.pendingFlowId),
  ],
)

// ── Execution plane ──────────────────────────────────────────────────────────

/**
 * An intent is a transactional grouping of tool calls with a locked objective.
 *
 * Created at FORMED time. Status transitions are validated by the state machine
 * in `lib/aig/state.ts` — never UPDATE this table without going through the
 * `setIntentStatus` query.
 *
 * Every intent is owned by a workspace (tenant boundary) and traceable to the
 * user who initiated it.
 */
export const intents = pgTable(
  'intents',
  {
    id: text('id').primaryKey(),

    /** Tenant boundary. Cascade-delete with the workspace. */
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    /** User who ran the prompt that produced this intent. NULL for system runs. */
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),

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

    /** Identity of the human who approved this intent (Better Auth user id). */
    approvedByUserId: text('approved_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    /** Display email of approver at approval time (audit only). */
    approvedBy: text('approved_by'),
    approvedAt: bigint('approved_at', { mode: 'number' }),

    /** EXPIRED if `now() > expire_at` and not yet approved. */
    expireAt: bigint('expire_at', { mode: 'number' }).notNull(),

    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    index('intents_workspace_idx').on(t.workspaceId),
    index('intents_workspace_status_idx').on(t.workspaceId, t.status),
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

/**
 * A versioned template promoted from a completed (or review-ready) intent run.
 * `template` stores the tool DAG with positional dependencies for re-runs.
 */
export const pipelines = pgTable(
  'pipelines',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    /** Intent this template was promoted from (nullable if source deleted). */
    sourceIntentId: text('source_intent_id').references(() => intents.id, {
      onDelete: 'set null',
    }),
    version: integer('version').notNull().default(1),
    objective: text('objective').notNull(),
    systems: text('systems').array().notNull().default(sql`'{}'::text[]`),
    template: jsonb('template').notNull(),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    uniqueIndex('pipelines_workspace_name_version_uq').on(t.workspaceId, t.name, t.version),
    index('pipelines_workspace_idx').on(t.workspaceId),
    index('pipelines_source_intent_idx').on(t.sourceIntentId),
  ],
)

/**
 * Workspace approval policies are evaluated before an intent can be approved.
 * They are intentionally coarse for Sprint 4: match tool names with wildcard
 * patterns and either require an owner/admin approver or block approval.
 */
export const approvalPolicies = pgTable(
  'approval_policies',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(true),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
    updatedAt: bigint('updated_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    uniqueIndex('approval_policies_workspace_name_uq').on(t.workspaceId, t.name),
    index('approval_policies_workspace_idx').on(t.workspaceId),
  ],
)

export const approvalPolicyRules = pgTable(
  'approval_policy_rules',
  {
    id: text('id').primaryKey(),
    policyId: text('policy_id')
      .notNull()
      .references(() => approvalPolicies.id, { onDelete: 'cascade' }),
    toolPattern: text('tool_pattern').notNull(),
    action: approvalPolicyActionEnum('action').notNull(),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    index('approval_policy_rules_policy_idx').on(t.policyId),
    index('approval_policy_rules_pattern_idx').on(t.toolPattern),
  ],
)

/**
 * Append-only workspace audit for approval-policy evaluations. Mutations remain
 * the per-intent trace; this table supports workspace-level filtering/export,
 * including denied attempts that never create a `human_approved` mutation.
 */
export const policyDecisions = pgTable(
  'policy_decisions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    intentId: text('intent_id')
      .notNull()
      .references(() => intents.id, { onDelete: 'cascade' }),
    approverUserId: text('approver_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    approverEmail: text('approver_email'),
    approverRole: text('approver_role'),
    decision: policyDecisionOutcomeEnum('decision').notNull(),
    reason: text('reason'),
    matchedRules: jsonb('matched_rules').notNull().default(sql`'[]'::jsonb`),
    createdAt: bigint('created_at', { mode: 'number' })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (t) => [
    index('policy_decisions_workspace_created_idx').on(t.workspaceId, t.createdAt),
    index('policy_decisions_workspace_decision_idx').on(t.workspaceId, t.decision),
    index('policy_decisions_intent_idx').on(t.intentId),
    index('policy_decisions_approver_idx').on(t.approverUserId),
  ],
)

// ── Inferred types ───────────────────────────────────────────────────────────

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type WorkspaceKind = (typeof workspaceKindEnum.enumValues)[number]

export type ToolkitConnection = typeof toolkitConnections.$inferSelect
export type NewToolkitConnection = typeof toolkitConnections.$inferInsert
export type ConnectionAuthStatus = (typeof connectionAuthStatusEnum.enumValues)[number]
export type ConnectionScope = (typeof connectionScopeEnum.enumValues)[number]

export type Intent = typeof intents.$inferSelect
export type NewIntent = typeof intents.$inferInsert

export type ToolCall = typeof toolCalls.$inferSelect
export type NewToolCall = typeof toolCalls.$inferInsert

export type Mutation = typeof mutations.$inferSelect
export type NewMutation = typeof mutations.$inferInsert

export type ExecutionRecord = typeof executionRecords.$inferSelect
export type NewExecutionRecord = typeof executionRecords.$inferInsert

export type Pipeline = typeof pipelines.$inferSelect
export type NewPipeline = typeof pipelines.$inferInsert

export type ApprovalPolicy = typeof approvalPolicies.$inferSelect
export type NewApprovalPolicy = typeof approvalPolicies.$inferInsert
export type ApprovalPolicyRule = typeof approvalPolicyRules.$inferSelect
export type NewApprovalPolicyRule = typeof approvalPolicyRules.$inferInsert
export type ApprovalPolicyAction = (typeof approvalPolicyActionEnum.enumValues)[number]

export type PolicyDecision = typeof policyDecisions.$inferSelect
export type NewPolicyDecision = typeof policyDecisions.$inferInsert
export type PolicyDecisionOutcome = (typeof policyDecisionOutcomeEnum.enumValues)[number]

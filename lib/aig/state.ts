/**
 * AIG Intent Lifecycle State Machine.
 *
 * PURE module — no DB, no fetch, no fs, no env. Every transition is checked
 * here BEFORE the persistence layer commits anything.
 *
 * See ADR-0001 for why we use plan-then-execute and ADR-0005 for why the
 * co-authorship trace (mutations table) is the primary UI surface this
 * lifecycle drives.
 */

import {
  AIGCycleError,
  AIGInvalidTransitionError,
  type IntentStatus,
  type ToolCallStatus,
} from './types'

// ── Transition table ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Readonly<Record<IntentStatus, ReadonlyArray<IntentStatus>>> = {
  DRAFT: ['FORMED', 'UNCERTAIN'],
  UNCERTAIN: ['DRAFT', 'PENDING_REVIEW', 'BLOCKED'],
  FORMED: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['APPROVED', 'MODIFIED', 'BLOCKED', 'EXPIRED'],
  MODIFIED: ['REGENERATING', 'PENDING_REVIEW'],
  REGENERATING: ['PENDING_REVIEW', 'FAILED'],
  APPROVED: ['EXECUTING'],
  EXECUTING: ['COMPLETE', 'PARTIAL_FAILURE', 'FAILED'],
  COMPLETE: [],
  PARTIAL_FAILURE: ['FAILED'],
  FAILED: [],
  BLOCKED: [],
  EXPIRED: [],
}

const TERMINAL_STATUSES = new Set<IntentStatus>(['COMPLETE', 'FAILED', 'BLOCKED', 'EXPIRED'])

/**
 * Throws `AIGInvalidTransitionError` if the transition is not in the table.
 * Returns `void` on success.
 */
export function assertTransition(current: IntentStatus, next: IntentStatus): void {
  const allowed = VALID_TRANSITIONS[current]
  if (!allowed.includes(next)) {
    throw new AIGInvalidTransitionError(current, next)
  }
}

/** Pure predicate — does not throw. */
export function canTransition(current: IntentStatus, next: IntentStatus): boolean {
  return VALID_TRANSITIONS[current].includes(next)
}

export function isTerminal(status: IntentStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

export function allowedNextStatuses(status: IntentStatus): ReadonlyArray<IntentStatus> {
  return VALID_TRANSITIONS[status]
}

// ── Tool-call immutability ───────────────────────────────────────────────────

const POST_APPROVAL_INTENT_STATUSES = new Set<IntentStatus>([
  'APPROVED',
  'EXECUTING',
  'COMPLETE',
  'PARTIAL_FAILURE',
  'FAILED',
])

/**
 * A tool call is immutable if it has been approved/done or its parent intent
 * has moved past APPROVED. Repair MUST treat these as locked.
 */
export function isToolCallImmutable(
  toolCallStatus: ToolCallStatus,
  intentStatus: IntentStatus,
): boolean {
  if (toolCallStatus === 'approved' || toolCallStatus === 'done') return true
  return POST_APPROVAL_INTENT_STATUSES.has(intentStatus)
}

// ── Dependency invalidation ──────────────────────────────────────────────────

interface DagNode {
  id: string
  dependsOn: ReadonlyArray<string>
}

/**
 * Given a set of directly removed/invalidated node IDs, compute the full
 * transitive closure of nodes that must also be invalidated.
 *
 * Walks the dependency graph breadth-first via the reverse map (id → its
 * dependents). The seed IDs are always included in the result.
 */
export function computeInvalidatedIds(
  nodes: ReadonlyArray<DagNode>,
  seedIds: ReadonlySet<string>,
): Set<string> {
  const dependents = new Map<string, string[]>()
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      const arr = dependents.get(dep) ?? []
      arr.push(node.id)
      dependents.set(dep, arr)
    }
  }

  const invalidated = new Set<string>(seedIds)
  const queue: string[] = [...seedIds]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    const next = dependents.get(current) ?? []
    for (const childId of next) {
      if (!invalidated.has(childId)) {
        invalidated.add(childId)
        queue.push(childId)
      }
    }
  }

  return invalidated
}

// ── Topological sort ─────────────────────────────────────────────────────────

/**
 * Returns node IDs in execution order (dependencies first). Throws
 * `AIGCycleError` if a cycle is detected. Determinism: ties are broken
 * by the original order of `nodes` (stable Kahn's algorithm).
 */
export function topologicalSort(nodes: ReadonlyArray<DagNode>): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  const order = new Map<string, number>()

  nodes.forEach((node, idx) => {
    order.set(node.id, idx)
    if (!inDegree.has(node.id)) inDegree.set(node.id, 0)
    if (!adjacency.has(node.id)) adjacency.set(node.id, [])
    for (const dep of node.dependsOn) {
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1)
      const arr = adjacency.get(dep) ?? []
      arr.push(node.id)
      adjacency.set(dep, arr)
    }
  })

  const ready: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) ready.push(id)
  }
  ready.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))

  const result: string[] = []
  while (ready.length > 0) {
    const current = ready.shift()
    if (current === undefined) break
    result.push(current)

    const neighbors = (adjacency.get(current) ?? []).slice()
    neighbors.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))

    for (const neighbor of neighbors) {
      const next = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, next)
      if (next === 0) {
        ready.push(neighbor)
        ready.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      }
    }
  }

  if (result.length !== nodes.length) {
    throw new AIGCycleError()
  }
  return result
}

/**
 * Pipeline template construction — pure domain, no I/O.
 *
 * A pipeline is a versioned snapshot of a successful run's objective + tool DAG.
 */

import type { RollbackPolicy } from './types'

export interface PipelineToolCallTemplate {
  tool: string
  args: Record<string, unknown>
  /** Positional refs (@0, @1) — resolved to ULIDs at run time. */
  dependsOn: string[]
  position: number
  rollbackPolicy?: RollbackPolicy
}

export interface PipelineTemplate {
  label: string
  description: string
  objective: string
  systems: string[]
  confidence: number | null
  toolCalls: PipelineToolCallTemplate[]
}

export interface PipelineSourceToolCall {
  id: string
  tool: string
  args: unknown
  dependsOn: string[]
  position: number
  rollbackPolicy?: RollbackPolicy
}

const PROMOTABLE_STATUSES = new Set(['COMPLETE', 'PENDING_REVIEW', 'APPROVED', 'EXECUTING'])

export function canPromoteIntentStatus(status: string): boolean {
  return PROMOTABLE_STATUSES.has(status)
}

/**
 * Convert persisted tool calls (dependsOn = ULIDs) into a positional template
 * suitable for re-instantiation via createIntent.
 */
export function buildPipelineTemplate(input: {
  label: string
  description: string
  objective: string
  systems: string[]
  confidence: number | null
  toolCalls: ReadonlyArray<PipelineSourceToolCall>
}): PipelineTemplate {
  const ordered = [...input.toolCalls].sort((a, b) => a.position - b.position)
  const idToPosition = new Map<string, number>()
  for (const tc of ordered) {
    idToPosition.set(tc.id, tc.position)
  }

  const toolCalls: PipelineToolCallTemplate[] = ordered.map((tc) => ({
    tool: tc.tool,
    args: asRecord(tc.args),
    position: tc.position,
    dependsOn: tc.dependsOn.map((ref) => {
      if (ref.startsWith('@')) return ref
      const pos = idToPosition.get(ref)
      if (pos === undefined) return ref
      return `@${pos}`
    }),
    ...(tc.rollbackPolicy ? { rollbackPolicy: tc.rollbackPolicy } : {}),
  }))

  return {
    label: input.label,
    description: input.description,
    objective: input.objective,
    systems: [...input.systems],
    confidence: input.confidence,
    toolCalls,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

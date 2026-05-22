import type { RepairInput, RepairResponse } from '@/lib/aig/types'

/**
 * Deterministic repair response for Playwright / CI when Arcade is mocked.
 * Preserves all non-invalidated nodes and removes invalidated ones without
 * calling Claude.
 */
export function buildE2eRepairResponse(input: RepairInput): RepairResponse {
  const invalidatedIds = new Set(input.invalidatedNodes.map((node) => node.id))
  const preserve = [...input.preservedNodes, ...input.lockedNodes]
    .map((node) => node.id)
    .filter((id) => !invalidatedIds.has(id))

  return {
    replace: [],
    preserve,
    remove: [...invalidatedIds],
  }
}

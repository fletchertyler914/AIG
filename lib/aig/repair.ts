/**
 * Constrained transactional graph repair engine.
 *
 * Each call is a fresh LLM session (no conversation history). Response is
 * validated with zod — invalid output throws AIGRepairContractError.
 *
 * See ADR-0003 and `.cursor/rules/20-repair.mdc`.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateObject } from 'ai'
import {
  AIGRepairContractError,
  type RepairInput,
  type RepairNode,
  type RepairResponse,
  repairResponseSchema,
} from './types'

const PROMPT_DIR = dirname(fileURLToPath(import.meta.url))
const SYSTEM_PROMPT = readFileSync(join(PROMPT_DIR, 'prompts', 'repair.system.md'), 'utf8')

function serializeNode(node: RepairNode) {
  return {
    id: node.id,
    tool: node.tool,
    args: node.args,
    locked: node.locked,
    humanEdited: node.humanEdited,
    dependsOn: node.dependsOn,
  }
}

function buildUserPrompt(input: RepairInput): string {
  return JSON.stringify(
    {
      objective: input.objective,
      objective_locked: input.objectiveLocked,
      lockedNodes: input.lockedNodes.map(serializeNode),
      invalidatedNodes: input.invalidatedNodes.map(serializeNode),
      preservedNodes: input.preservedNodes.map(serializeNode),
      humanReason: input.humanReason ?? null,
    },
    null,
    2,
  )
}

/**
 * Validate repair response against hard invariants beyond zod shape.
 */
export function assertRepairContract(input: RepairInput, response: RepairResponse): void {
  const lockedIds = new Set(input.lockedNodes.map((n) => n.id))
  const humanEditedIds = new Set(input.lockedNodes.filter((n) => n.humanEdited).map((n) => n.id))
  for (const id of [...input.preservedNodes, ...input.lockedNodes]
    .filter((n) => n.humanEdited)
    .map((n) => n.id)) {
    humanEditedIds.add(id)
  }

  const invalidatedIds = new Set(input.invalidatedNodes.map((n) => n.id))

  for (const id of lockedIds) {
    if (!response.preserve.includes(id)) {
      throw new AIGRepairContractError(`locked node ${id} missing from preserve`)
    }
  }

  for (const id of invalidatedIds) {
    if (!response.remove.includes(id)) {
      throw new AIGRepairContractError(`invalidated node ${id} missing from remove`)
    }
  }

  for (const id of response.preserve) {
    if (invalidatedIds.has(id)) {
      throw new AIGRepairContractError(`invalidated node ${id} cannot be preserved`)
    }
  }

  for (const id of response.remove) {
    if (lockedIds.has(id)) {
      throw new AIGRepairContractError(`locked node ${id} cannot be removed`)
    }
  }

  const overlap = response.preserve.filter((id) => response.remove.includes(id))
  if (overlap.length > 0) {
    throw new AIGRepairContractError(`id(s) in both preserve and remove: ${overlap.join(', ')}`)
  }
}

export interface RepairIntentOptions {
  /** Override for tests — inject a canned response instead of calling Claude. */
  mockResponse?: RepairResponse
}

/**
 * Repair an intent transaction after human mutation.
 *
 * Opens a new LLM session every call. Never threads conversation history.
 */
export async function repairIntent(
  input: RepairInput,
  options: RepairIntentOptions = {},
): Promise<RepairResponse> {
  if (input.objectiveLocked !== true) {
    throw new AIGRepairContractError('objectiveLocked must be true')
  }

  let response: RepairResponse

  if (options.mockResponse) {
    response = repairResponseSchema.parse(options.mockResponse)
  } else {
    const { CLAUDE_SONNET } = await import('@/lib/ai/anthropic')
    const { object } = await generateObject({
      model: CLAUDE_SONNET,
      schema: repairResponseSchema,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(input),
      temperature: 0,
    })
    response = object
  }

  assertRepairContract(input, response)
  return response
}

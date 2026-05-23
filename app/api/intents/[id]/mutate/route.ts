import { z } from 'zod'
import { buildE2eRepairResponse } from '@/lib/aig/e2e-repair'
import { repairIntent } from '@/lib/aig/repair'
import { computeInvalidatedIds } from '@/lib/aig/state'
import type { RepairInput, RepairNode } from '@/lib/aig/types'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import {
  appendMutation,
  editToolCallArgs,
  getIntentWithTrace,
  insertHumanToolCall,
  insertReplacementToolCalls,
  invalidateToolCalls,
  setIntentStatus,
} from '@/lib/db/queries'
import type { Mutation, ToolCall } from '@/lib/db/schema'
import { isArcadeMocked } from '@/lib/env'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

const mutateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('remove'),
    toolCallId: z.string().min(1),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('edit'),
    toolCallId: z.string().min(1),
    args: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('add'),
    tool: z.string().min(1),
    args: z.record(z.string(), z.unknown()),
    dependsOn: z.array(z.string()).default([]),
    afterToolCallId: z.string().min(1).optional(),
    reason: z.string().optional(),
  }),
])

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function humanControlledIds(mutations: Mutation[]): Set<string> {
  const ids = new Set<string>()
  for (const mutation of mutations) {
    if (mutation.type !== 'human_edited' && mutation.type !== 'human_added') continue
    const payload = asRecord(mutation.payload)
    const id = payload['toolCallId'] ?? payload['insertedToolCallId']
    if (typeof id === 'string') ids.add(id)
  }
  return ids
}

function repairNode(call: ToolCall, editedIds: Set<string>): RepairNode {
  return {
    id: call.id,
    tool: call.tool,
    args: asRecord(call.args),
    locked: call.locked || call.status === 'approved' || call.status === 'done',
    humanEdited: editedIds.has(call.id),
    dependsOn: call.dependsOn,
  }
}

function directDependents(calls: ToolCall[], toolCallId: string): string[] {
  return calls.filter((call) => call.dependsOn.includes(toolCallId)).map((call) => call.id)
}

async function maybeTransitionForMutation(intentId: string, status: string) {
  if (status === 'PENDING_REVIEW') {
    await setIntentStatus(intentId, 'MODIFIED')
  }
  if (status === 'UNCERTAIN') {
    await setIntentStatus(intentId, 'PENDING_REVIEW')
    await setIntentStatus(intentId, 'MODIFIED')
  }
}

async function regenerate(input: { intentId: string; seedIds: Set<string>; reason?: string }) {
  const snapshot = await getIntentWithTrace(input.intentId)
  if (!snapshot) throw new Error('Intent not found')

  const invalidatedIds = computeInvalidatedIds(
    snapshot.toolCalls.map((call) => ({ id: call.id, dependsOn: call.dependsOn })),
    input.seedIds,
  )

  await invalidateToolCalls(input.intentId, Array.from(invalidatedIds))
  await appendMutation({
    intentId: input.intentId,
    type: 'system_invalidated',
    actor: 'system',
    payload: {
      seedIds: Array.from(input.seedIds),
      invalidatedIds: Array.from(invalidatedIds),
    },
  })

  await setIntentStatus(input.intentId, 'REGENERATING')

  const nextSnapshot = await getIntentWithTrace(input.intentId)
  if (!nextSnapshot) throw new Error('Intent not found')

  const editedIds = humanControlledIds(nextSnapshot.mutations)
  const invalidatedNodes = nextSnapshot.toolCalls
    .filter((call) => invalidatedIds.has(call.id))
    .map((call) => repairNode(call, editedIds))
  const preservedNodes = nextSnapshot.toolCalls
    .filter((call) => !invalidatedIds.has(call.id))
    .map((call) => repairNode(call, editedIds))

  const repairInput: RepairInput = {
    objective: nextSnapshot.intent.objective,
    objectiveLocked: true,
    lockedNodes: preservedNodes.filter((node) => node.locked),
    invalidatedNodes,
    preservedNodes: preservedNodes.filter((node) => !node.locked),
    ...(input.reason ? { humanReason: input.reason } : {}),
  }

  const response = await repairIntent(
    repairInput,
    isArcadeMocked ? { mockResponse: buildE2eRepairResponse(repairInput) } : {},
  )
  const inserted = await insertReplacementToolCalls(input.intentId, response.replace)

  await appendMutation({
    intentId: input.intentId,
    type: 'agent_regenerated',
    actor: 'agent',
    payload: {
      replace: response.replace,
      preserve: response.preserve,
      remove: response.remove,
      insertedToolCallIds: inserted.map((call) => call.id),
    },
  })

  await setIntentStatus(input.intentId, 'PENDING_REVIEW')
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const body = parseJson(mutateSchema, await request.json())
    const snapshot = await getIntentWithTrace(id)
    if (!snapshot) return jsonError('Intent not found', 404)

    await maybeTransitionForMutation(id, snapshot.intent.status)

    if (body.type === 'add') {
      const dependsOn = Array.from(
        new Set([...(body.afterToolCallId ? [body.afterToolCallId] : []), ...body.dependsOn]),
      )
      const inserted = await insertHumanToolCall({
        intentId: id,
        tool: body.tool,
        args: body.args,
        dependsOn,
      })

      await appendMutation({
        intentId: id,
        type: 'human_added',
        actor: 'human',
        payload: {
          insertedToolCallId: inserted.id,
          tool: inserted.tool,
          args: body.args,
          dependsOn,
          reason: body.reason ?? null,
        },
      })

      const seedIds = body.afterToolCallId
        ? new Set(directDependents(snapshot.toolCalls, body.afterToolCallId))
        : new Set<string>()
      if (seedIds.size > 0) {
        await regenerate({
          intentId: id,
          seedIds,
          reason:
            body.reason ??
            `Human added ${body.tool}; update downstream actions to account for the new action.`,
        })
      } else {
        await setIntentStatus(id, 'PENDING_REVIEW')
      }
    } else if (body.type === 'remove') {
      await appendMutation({
        intentId: id,
        type: 'human_removed',
        actor: 'human',
        payload: { toolCallId: body.toolCallId, reason: body.reason ?? null },
      })
      await regenerate({
        intentId: id,
        seedIds: new Set([body.toolCallId]),
        ...(body.reason ? { reason: body.reason } : {}),
      })
    } else {
      const updated = await editToolCallArgs(body.toolCallId, body.args)
      if (!updated) return jsonError('Tool call not found or immutable', 404)

      await appendMutation({
        intentId: id,
        type: 'human_edited',
        actor: 'human',
        payload: { toolCallId: body.toolCallId, args: body.args, reason: body.reason ?? null },
      })

      const seedIds = new Set(directDependents(snapshot.toolCalls, body.toolCallId))
      if (seedIds.size > 0) {
        await regenerate({
          intentId: id,
          seedIds,
          ...(body.reason ? { reason: body.reason } : {}),
        })
      } else {
        await setIntentStatus(id, 'PENDING_REVIEW')
      }
    }

    const updated = await getIntentWithTrace(id)
    return jsonOk(updated)
  } catch (error) {
    logger.error({ err: error, intentId: id }, 'failed to mutate intent')
    return jsonError(messageFromUnknown(error), 400)
  }
}

/**
 * Intent executor.
 *
 * Pure ordering comes from `topologicalSort`; all side effects are delegated
 * through typed DB and Arcade wrappers. Rollback policy for MVP is
 * HALT_REMAINING (ADR-0004).
 */

import { validateConnectionForExecution } from '@/lib/aig/connection-auth'
import { topologicalSort } from '@/lib/aig/state'
import { AIGBlockedAuthError } from '@/lib/aig/types'
import { toolkitFromToolName } from '@/lib/arcade/identity'
import { executeArcadeTool } from '@/lib/arcade/tools'
import { isWorkspaceMember, resolveConnectionForTool } from '@/lib/db/connection-queries'
import {
  appendMutation,
  getIntentWithTrace,
  markToolCallExecuted,
  markToolCallFailed,
  recordExecution,
  setIntentStatus,
  setToolCallStatus,
} from '@/lib/db/queries'
import type { ToolCall } from '@/lib/db/schema'
import { isArcadeMocked } from '@/lib/env'
import { logger } from '@/lib/logger'

export interface ExecuteIntentInput {
  intentId: string
  approvedByUserId: string
}

export interface ExecuteIntentResult {
  status: 'COMPLETE' | 'PARTIAL_FAILURE' | 'FAILED'
  executed: string[]
  failed?: { toolCallId: string; error: string }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function formatArcadeError(output: unknown): string {
  const record = asRecord(output)
  const error = asRecord(record['error'])
  const message = error['message']
  if (typeof message === 'string') return message
  return 'Arcade tool execution failed'
}

function callById(calls: ToolCall[]): Map<string, ToolCall> {
  return new Map(calls.map((call) => [call.id, call]))
}

async function assertConnectionAuthorized(input: {
  connection: Awaited<ReturnType<typeof resolveConnectionForTool>>
  approverUserId: string
  workspaceId: string
  toolkitName: string
}) {
  const isMember = await isWorkspaceMember({
    workspaceId: input.workspaceId,
    userId: input.approverUserId,
  })

  return validateConnectionForExecution({
    connection: input.connection,
    approverUserId: input.approverUserId,
    isWorkspaceMember: isMember,
    toolkitName: input.toolkitName,
  })
}

export async function executeApprovedIntent({
  intentId,
  approvedByUserId,
}: ExecuteIntentInput): Promise<ExecuteIntentResult> {
  const snapshot = await getIntentWithTrace(intentId)
  if (!snapshot) throw new Error('Intent not found')

  const approverId = snapshot.intent.approvedByUserId ?? approvedByUserId
  if (!isArcadeMocked && approverId !== approvedByUserId) {
    throw new AIGBlockedAuthError(snapshot.intent.approvedBy ?? approverId, approvedByUserId)
  }

  await setIntentStatus(intentId, 'EXECUTING')

  const runnable = snapshot.toolCalls.filter((call) => call.status === 'approved')
  const sortedIds = topologicalSort(
    runnable.map((call) => ({
      id: call.id,
      dependsOn: call.dependsOn.filter((dep) => runnable.some((candidate) => candidate.id === dep)),
    })),
  )
  const calls = callById(runnable)
  const executed: string[] = []

  for (const id of sortedIds) {
    const call = calls.get(id)
    if (!call) continue

    const toolkitName = toolkitFromToolName(call.tool)

    let arcadeUserId: string
    if (isArcadeMocked) {
      arcadeUserId = `e2e:${approvedByUserId}`
    } else {
      const connection = await resolveConnectionForTool({
        workspaceId: snapshot.intent.workspaceId,
        approverUserId: approvedByUserId,
        toolkitName,
      })
      const authorized = await assertConnectionAuthorized({
        connection,
        approverUserId: approvedByUserId,
        workspaceId: snapshot.intent.workspaceId,
        toolkitName,
      })
      arcadeUserId = authorized.arcadeUserId
    }

    await setToolCallStatus(call.id, 'executing')

    try {
      logger.info(
        {
          intentId,
          toolCallId: call.id,
          tool: call.tool,
          arcadeUserId,
          mocked: isArcadeMocked,
        },
        'executing arcade tool',
      )
      const result = await executeArcadeTool({
        tool: call.tool,
        args: asRecord(call.argSnapshot ?? call.args),
        userId: arcadeUserId,
      })

      if (result.success === false || result.output?.error) {
        const error = formatArcadeError(result.output)
        await markToolCallFailed(call.id, error)
        await recordExecution({
          intentId,
          toolCallId: call.id,
          result: asRecord(result),
          error,
          success: false,
        })
        await appendMutation({
          intentId,
          type: 'arcade_failed',
          actor: 'system',
          payload: { toolCallId: call.id, tool: call.tool, error },
        })

        const status = executed.length > 0 ? 'PARTIAL_FAILURE' : 'FAILED'
        await setIntentStatus(intentId, status)
        return { status, executed, failed: { toolCallId: call.id, error } }
      }

      await markToolCallExecuted(call.id, asRecord(result))
      await recordExecution({
        intentId,
        toolCallId: call.id,
        result: asRecord(result),
        success: true,
      })
      await appendMutation({
        intentId,
        type: 'arcade_executed',
        actor: 'system',
        payload: { toolCallId: call.id, tool: call.tool, result },
      })
      executed.push(call.id)
    } catch (error) {
      if (error instanceof AIGBlockedAuthError) throw error

      const message = error instanceof Error ? error.message : 'Unknown execution error'
      await markToolCallFailed(call.id, message)
      await recordExecution({
        intentId,
        toolCallId: call.id,
        error: message,
        success: false,
      })
      await appendMutation({
        intentId,
        type: 'arcade_failed',
        actor: 'system',
        payload: { toolCallId: call.id, tool: call.tool, error: message },
      })

      const status = executed.length > 0 ? 'PARTIAL_FAILURE' : 'FAILED'
      await setIntentStatus(intentId, status)
      return { status, executed, failed: { toolCallId: call.id, error: message } }
    }
  }

  await setIntentStatus(intentId, 'COMPLETE')
  return { status: 'COMPLETE', executed }
}

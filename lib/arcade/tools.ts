import type { ExecuteToolResponse } from '@arcadeai/arcadejs/resources/tools'
import { getArcadeClient } from './client'

export interface ParsedArcadeToolName {
  toolName: string
  toolVersion?: string
}

export function parseArcadeToolName(tool: string): ParsedArcadeToolName {
  const [toolName, toolVersion] = tool.split('@')
  if (!toolName) throw new Error(`Invalid Arcade tool name: ${tool}`)
  return {
    toolName,
    ...(toolVersion ? { toolVersion } : {}),
  }
}

/**
 * When set, all Arcade `execute` calls short-circuit with a synthetic
 * success. Used by Playwright + integration tests so the demo loop can
 * exercise APPROVED → EXECUTING → COMPLETE without hitting real
 * accounts. Never enabled in production.
 */
function isMocked(): boolean {
  return process.env['E2E_MOCK_ARCADE'] === '1'
}

function mockedExecution(input: {
  tool: string
  args: Record<string, unknown>
}): ExecuteToolResponse {
  return {
    id: `mock-${Date.now()}`,
    duration: 0,
    execution_id: `mock-exec-${Date.now()}`,
    execution_type: 'immediate',
    finished_at: new Date().toISOString(),
    run_at: new Date().toISOString(),
    status: 'success',
    success: true,
    output: {
      value: {
        mocked: true,
        tool: input.tool,
        echoedArgs: input.args,
      },
    },
  } as unknown as ExecuteToolResponse
}

export async function executeArcadeTool(input: {
  tool: string
  args: Record<string, unknown>
  userId: string
}): Promise<ExecuteToolResponse> {
  if (isMocked()) return mockedExecution(input)
  const { toolName, toolVersion } = parseArcadeToolName(input.tool)
  return getArcadeClient().tools.execute({
    tool_name: toolName,
    ...(toolVersion ? { tool_version: toolVersion } : {}),
    input: input.args,
    user_id: input.userId,
    include_error_stacktrace: true,
  })
}

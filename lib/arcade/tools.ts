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

export async function executeArcadeTool(input: {
  tool: string
  args: Record<string, unknown>
  userId: string
}): Promise<ExecuteToolResponse> {
  const { toolName, toolVersion } = parseArcadeToolName(input.tool)
  return getArcadeClient().tools.execute({
    tool_name: toolName,
    ...(toolVersion ? { tool_version: toolVersion } : {}),
    input: input.args,
    user_id: input.userId,
    include_error_stacktrace: true,
  })
}

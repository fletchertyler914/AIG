export interface IntentDto {
  id: string
  label: string
  description: string
  objective: string
  status: string
  systems: string[]
  impact: unknown
  confidence: string | null
  approvedBy: string | null
  approvedAt: number | null
  createdAt: number
}

export interface ToolCallDto {
  id: string
  intentId: string
  tool: string
  args: unknown
  status: string
  dependsOn: string[]
  locked: boolean
  position: number
  execResult: unknown
  execError: string | null
}

export interface MutationDto {
  id: string
  intentId: string
  mutationIndex: number
  type: string
  actor: 'agent' | 'human' | 'system'
  payload: unknown
  ts: number
}

export interface IntentWithTraceDto {
  intent: IntentDto
  toolCalls: ToolCallDto[]
  mutations: MutationDto[]
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/**
 * Per-tool authorization surface.
 *
 * Calls `tools.authorize` for every unique tool a plan touched. If any
 * tool returns a `pending` / `not_started` status with an `url`, the UI
 * surfaces it so the operator can complete Arcade's OAuth flow before
 * the intent leaves UNCERTAIN.
 */

import { getArcadeClient } from './client'
import { parseArcadeToolName } from './tools'

export interface ToolAuthorizationStatus {
  /** Fully-qualified Arcade tool name as supplied. */
  tool: string
  /** Auth status as reported by Arcade. */
  status: 'completed' | 'pending' | 'not_started' | 'failed' | 'unknown'
  /** OAuth URL the operator must visit (only set when status !== 'completed'). */
  url?: string
  /** OAuth provider id (e.g. 'google', 'slack') — useful for label text. */
  providerId?: string
}

export interface AuthorizeManyOptions {
  /** Inject for tests. */
  authorizer?: (input: { tool: string; userId: string }) => Promise<ToolAuthorizationStatus>
}

/**
 * Returns the union of unique tools (deduped by `tool_name`, version
 * stripped) along with their current authorization status.
 *
 * The list ordering matches first appearance in the input array so the
 * UI can render predictably.
 */
export async function authorizeMany(
  tools: ReadonlyArray<string>,
  userId: string,
  options: AuthorizeManyOptions = {},
): Promise<ToolAuthorizationStatus[]> {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const t of tools) {
    if (seen.has(t)) continue
    seen.add(t)
    ordered.push(t)
  }
  const authorizer = options.authorizer ?? defaultAuthorizer
  return Promise.all(ordered.map((tool) => authorizer({ tool, userId })))
}

async function defaultAuthorizer(input: {
  tool: string
  userId: string
}): Promise<ToolAuthorizationStatus> {
  const arcade = getArcadeClient()
  const { toolName, toolVersion } = parseArcadeToolName(input.tool)
  const res = await arcade.tools.authorize({
    tool_name: toolName,
    user_id: input.userId,
    ...(toolVersion ? { tool_version: toolVersion } : {}),
  })

  const status = normalizeStatus(res.status)
  const out: ToolAuthorizationStatus = {
    tool: input.tool,
    status,
  }
  if (res.url) out.url = res.url
  if (res.provider_id) out.providerId = res.provider_id
  return out
}

function normalizeStatus(raw: string | undefined): ToolAuthorizationStatus['status'] {
  switch (raw) {
    case 'completed':
    case 'pending':
    case 'not_started':
    case 'failed':
      return raw
    default:
      return 'unknown'
  }
}

export function hasPendingAuthorizations(
  statuses: ReadonlyArray<ToolAuthorizationStatus>,
): boolean {
  return statuses.some((s) => s.status !== 'completed')
}

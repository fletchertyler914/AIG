/**
 * Stable Arcade identity primitives.
 *
 * AIG owns operator identity via Better Auth. Arcade `user_id` is a separate,
 * prefixed namespace so we never pass raw emails to Arcade APIs.
 */

export type ConnectionScope = 'personal' | 'shared'

export type ArcadeIdentity =
  | { kind: 'personal'; userId: string }
  | { kind: 'shared'; workspaceId: string }

export function toArcadeUserId(identity: ArcadeIdentity): string {
  return identity.kind === 'personal'
    ? `user:${identity.userId}`
    : `workspace:${identity.workspaceId}`
}

export function personalArcadeIdentity(userId: string): ArcadeIdentity {
  return { kind: 'personal', userId }
}

export function sharedArcadeIdentity(workspaceId: string): ArcadeIdentity {
  return { kind: 'shared', workspaceId }
}

export function arcadeIdentityForScope(input: {
  scope: ConnectionScope
  userId: string
  workspaceId: string
}): ArcadeIdentity {
  return input.scope === 'personal'
    ? personalArcadeIdentity(input.userId)
    : sharedArcadeIdentity(input.workspaceId)
}

/** Extract toolkit name from a fully-qualified Arcade tool, e.g. "Gmail.SendEmail@7.0.0". */
export function toolkitFromToolName(tool: string): string {
  const base = tool.split('@')[0] ?? tool
  const dot = base.indexOf('.')
  return dot === -1 ? base : base.slice(0, dot)
}

/**
 * Parse `flow_id` from an Arcade OAuth redirect URL.
 * Returns null when the URL does not contain a flow id.
 */
export function parseFlowIdFromAuthUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('flow_id')
  } catch {
    return null
  }
}

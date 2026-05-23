/**
 * Stable Arcade identity primitives.
 *
 * AIG owns operator identity via Better Auth. Arcade `user_id` encoding depends
 * on verifier mode (see `getArcadeVerifierMode` in `lib/env.ts`):
 *
 * - **arcade** (local dev default) — personal scope uses the operator email so
 *   Arcade's built-in user verifier matches the arcade.dev browser session.
 * - **custom** (production default) — prefixed stable IDs for multi-user + our
 *   `/api/arcade/verify` route.
 */

import { type ArcadeVerifierMode, env, getArcadeVerifierMode } from '@/lib/env'

export type ConnectionScope = 'personal' | 'shared'

export type ArcadeIdentity =
  | { kind: 'personal'; userId: string; email?: string }
  | { kind: 'shared'; workspaceId: string }

export function toArcadeUserId(
  identity: ArcadeIdentity,
  options?: { verifierMode?: ArcadeVerifierMode },
): string {
  const mode = options?.verifierMode ?? getArcadeVerifierMode()

  if (identity.kind === 'shared') {
    return `workspace:${identity.workspaceId}`
  }

  if (mode === 'arcade') {
    if (identity.email) return identity.email
    return env.DEMO_USER_ID
  }

  return `user:${identity.userId}`
}

/** Whether workspace-scoped (shared) OAuth is supported in the current verifier mode. */
export function sharedArcadeIdentitySupported(options?: {
  verifierMode?: ArcadeVerifierMode
}): boolean {
  return (options?.verifierMode ?? getArcadeVerifierMode()) === 'custom'
}

export function personalArcadeIdentity(userId: string, email?: string | null): ArcadeIdentity {
  return {
    kind: 'personal',
    userId,
    ...(email ? { email } : {}),
  }
}

export function sharedArcadeIdentity(workspaceId: string): ArcadeIdentity {
  return { kind: 'shared', workspaceId }
}

export function arcadeIdentityForScope(input: {
  scope: ConnectionScope
  userId: string
  workspaceId: string
  email?: string | null
}): ArcadeIdentity {
  return input.scope === 'personal'
    ? personalArcadeIdentity(input.userId, input.email)
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

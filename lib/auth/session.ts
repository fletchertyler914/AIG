/**
 * Session + workspace context helpers for server components and API routes.
 */

import { headers } from 'next/headers'
import { personalArcadeIdentity, toArcadeUserId } from '@/lib/arcade/identity'
import { auth } from '@/lib/auth/server'
import { getMemberRole } from '@/lib/db/connection-queries'
import type { ConnectionScope, Workspace } from '@/lib/db/schema'
import { ensureDefaultWorkspace } from '@/lib/db/workspace-queries'

export type Session = Awaited<ReturnType<typeof auth.api.getSession>>

export interface WorkspaceContext {
  userId: string
  email: string
  organizationId: string | null
  memberRole: string | null
  workspace: Workspace
  personalArcadeUserId: string
}

export async function getSession(): Promise<Session> {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireSession(): Promise<NonNullable<Session>> {
  const session = await getSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return session
}

export function canManageSharedConnections(role: string | null): boolean {
  return role === 'owner' || role === 'admin'
}

export async function resolveWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await getSession()

  if (session?.user) {
    const { provisionTenantForUser } = await import('@/lib/auth/provision')
    const { workspace, organizationId } = await provisionTenantForUser({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    })

    const memberRole = await getMemberRole({
      organizationId,
      userId: session.user.id,
    })

    return {
      userId: session.user.id,
      email: session.user.email,
      organizationId,
      memberRole,
      workspace,
      personalArcadeUserId: toArcadeUserId(personalArcadeIdentity(session.user.id)),
    }
  }

  const workspace = await ensureDefaultWorkspace()
  return {
    userId: 'anonymous',
    email: '',
    organizationId: workspace.organizationId,
    memberRole: null,
    workspace,
    personalArcadeUserId: toArcadeUserId(personalArcadeIdentity('anonymous')),
  }
}

export type { ConnectionScope }

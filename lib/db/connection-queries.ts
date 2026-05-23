import { and, asc, eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import type { ToolkitCatalogEntry } from '@/lib/arcade/catalog'
import {
  arcadeIdentityForScope,
  parseFlowIdFromAuthUrl,
  toArcadeUserId,
} from '@/lib/arcade/identity'
import { db } from '@/lib/db/client'
import {
  type ConnectionAuthStatus,
  type ConnectionScope,
  member,
  type ToolkitConnection,
  toolkitConnections,
  workspaces,
} from '@/lib/db/schema'

export async function listToolkitConnections(workspaceId: string): Promise<ToolkitConnection[]> {
  return db
    .select()
    .from(toolkitConnections)
    .where(eq(toolkitConnections.workspaceId, workspaceId))
    .orderBy(asc(toolkitConnections.toolkitName), asc(toolkitConnections.scope))
}

export async function listToolkitConnectionsForUser(input: {
  workspaceId: string
  userId: string
}): Promise<{ personal: ToolkitConnection[]; shared: ToolkitConnection[] }> {
  const rows = await listToolkitConnections(input.workspaceId)
  return {
    personal: rows.filter((row) => row.scope === 'personal' && row.ownerUserId === input.userId),
    shared: rows.filter((row) => row.scope === 'shared'),
  }
}

export async function getToolkitConnection(input: {
  workspaceId: string
  toolkitName: string
  scope: ConnectionScope
  ownerUserId?: string | null
}): Promise<ToolkitConnection | null> {
  const conditions = [
    eq(toolkitConnections.workspaceId, input.workspaceId),
    eq(toolkitConnections.toolkitName, input.toolkitName),
    eq(toolkitConnections.scope, input.scope),
  ]

  if (input.scope === 'personal') {
    conditions.push(eq(toolkitConnections.ownerUserId, input.ownerUserId ?? ''))
  }

  const [row] = await db
    .select()
    .from(toolkitConnections)
    .where(and(...conditions))
    .limit(1)
  return row ?? null
}

export async function getToolkitConnectionByPendingFlow(
  flowId: string,
): Promise<ToolkitConnection | null> {
  const [row] = await db
    .select()
    .from(toolkitConnections)
    .where(eq(toolkitConnections.pendingFlowId, flowId))
    .limit(1)
  return row ?? null
}

export async function listEnabledToolkitNames(workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ toolkitName: toolkitConnections.toolkitName })
    .from(toolkitConnections)
    .where(
      and(eq(toolkitConnections.workspaceId, workspaceId), eq(toolkitConnections.enabled, true)),
    )
    .orderBy(asc(toolkitConnections.toolkitName))
  return [...new Set(rows.map((row) => row.toolkitName))]
}

/**
 * Resolve the connection that should execute a tool for the given approver.
 * Personal connection for the approver wins over a shared workspace connection.
 */
export async function resolveConnectionForTool(input: {
  workspaceId: string
  approverUserId: string
  toolkitName: string
}): Promise<ToolkitConnection | null> {
  const personal = await getToolkitConnection({
    workspaceId: input.workspaceId,
    toolkitName: input.toolkitName,
    scope: 'personal',
    ownerUserId: input.approverUserId,
  })
  if (personal?.authStatus === 'completed') return personal

  const shared = await getToolkitConnection({
    workspaceId: input.workspaceId,
    toolkitName: input.toolkitName,
    scope: 'shared',
  })
  if (shared?.authStatus === 'completed') return shared

  return personal ?? shared ?? null
}

export async function isWorkspaceMember(input: {
  workspaceId: string
  userId: string
}): Promise<boolean> {
  const [row] = await db
    .select({ userId: member.userId })
    .from(workspaces)
    .innerJoin(member, eq(member.organizationId, workspaces.organizationId))
    .where(and(eq(workspaces.id, input.workspaceId), eq(member.userId, input.userId)))
    .limit(1)
  return Boolean(row)
}

export async function getMemberRole(input: {
  organizationId: string
  userId: string
}): Promise<string | null> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, input.organizationId), eq(member.userId, input.userId)))
    .limit(1)
  return row?.role ?? null
}

export async function upsertToolkitConnection(input: {
  workspaceId: string
  catalogEntry: ToolkitCatalogEntry
  scope: ConnectionScope
  ownerUserId?: string | null
  operatorEmail?: string | null
  enabled?: boolean
  authStatus?: ConnectionAuthStatus
  authUrl?: string | null
  providerId?: string | null
  arcadeUserId?: string | null
  pendingFlowId?: string | null
  oauthReturnTo?: string | null
  connectedAt?: number | null
}): Promise<ToolkitConnection> {
  const now = Date.now()
  const identity = arcadeIdentityForScope({
    scope: input.scope,
    userId: input.ownerUserId ?? '',
    workspaceId: input.workspaceId,
    ...(input.operatorEmail !== undefined ? { email: input.operatorEmail } : {}),
  })
  const arcadeUserId = input.arcadeUserId ?? toArcadeUserId(identity)
  const pendingFlowId =
    input.pendingFlowId ?? (input.authUrl ? parseFlowIdFromAuthUrl(input.authUrl) : null) ?? null

  const existing = await getToolkitConnection({
    workspaceId: input.workspaceId,
    toolkitName: input.catalogEntry.name,
    scope: input.scope,
    ...(input.scope === 'personal' ? { ownerUserId: input.ownerUserId ?? null } : {}),
  })

  if (existing) {
    const [row] = await db
      .update(toolkitConnections)
      .set({
        toolkitDescription: input.catalogEntry.description,
        representativeTool: input.catalogEntry.representativeTool,
        toolCount: input.catalogEntry.toolCount,
        arcadeUserId,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.authStatus !== undefined ? { authStatus: input.authStatus } : {}),
        ...(input.authUrl !== undefined ? { authUrl: input.authUrl } : {}),
        ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
        ...(pendingFlowId !== null ? { pendingFlowId } : {}),
        ...(input.oauthReturnTo !== undefined ? { oauthReturnTo: input.oauthReturnTo } : {}),
        ...(input.connectedAt !== undefined ? { connectedAt: input.connectedAt } : {}),
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(toolkitConnections.id, existing.id))
      .returning()
    if (!row) throw new Error('failed to update toolkit connection')
    return row
  }

  const [row] = await db
    .insert(toolkitConnections)
    .values({
      id: ulid(),
      workspaceId: input.workspaceId,
      toolkitName: input.catalogEntry.name,
      toolkitDescription: input.catalogEntry.description,
      representativeTool: input.catalogEntry.representativeTool,
      toolCount: input.catalogEntry.toolCount,
      scope: input.scope,
      ownerUserId: input.scope === 'personal' ? (input.ownerUserId ?? null) : null,
      enabled: input.enabled ?? false,
      authStatus: input.authStatus ?? 'unknown',
      authUrl: input.authUrl ?? null,
      providerId: input.providerId ?? null,
      arcadeUserId,
      pendingFlowId,
      oauthReturnTo: input.oauthReturnTo ?? null,
      connectedAt: input.connectedAt ?? null,
      lastCheckedAt: now,
      updatedAt: now,
    })
    .returning()

  if (!row) throw new Error('failed to insert toolkit connection')
  return row
}

/**
 * Ensure the workspace has an enabled connection row for the given toolkit so
 * planning can include it in the tool schema. Never mutates `authStatus` —
 * the existing AUTH REQUIRED affordance handles OAuth at approve time.
 *
 * Returns the row when the toolkit was found (either via an existing row or
 * via the provided catalog lookup) and `null` when the toolkit cannot be
 * resolved against Arcade.
 */
export async function ensureToolkitConnectionForPlanning(input: {
  workspaceId: string
  ownerUserId: string | null
  toolkitName: string
  arcadeUserId: string
  lookupCatalog: () => Promise<ToolkitCatalogEntry | null>
}): Promise<ToolkitConnection | null> {
  const personal = await getToolkitConnection({
    workspaceId: input.workspaceId,
    toolkitName: input.toolkitName,
    scope: 'personal',
    ownerUserId: input.ownerUserId,
  })

  if (personal) {
    if (personal.enabled) return personal
    return setToolkitConnectionEnabled({
      workspaceId: input.workspaceId,
      toolkitName: input.toolkitName,
      scope: 'personal',
      ownerUserId: input.ownerUserId,
      enabled: true,
    })
  }

  const shared = await getToolkitConnection({
    workspaceId: input.workspaceId,
    toolkitName: input.toolkitName,
    scope: 'shared',
  })

  if (shared) {
    if (shared.enabled) return shared
    return setToolkitConnectionEnabled({
      workspaceId: input.workspaceId,
      toolkitName: input.toolkitName,
      scope: 'shared',
      enabled: true,
    })
  }

  const catalogEntry = await input.lookupCatalog()
  if (!catalogEntry) return null

  return upsertToolkitConnection({
    workspaceId: input.workspaceId,
    catalogEntry,
    scope: 'personal',
    ownerUserId: input.ownerUserId,
    enabled: true,
    arcadeUserId: input.arcadeUserId,
  })
}

export async function setToolkitConnectionEnabled(input: {
  workspaceId: string
  toolkitName: string
  scope: ConnectionScope
  ownerUserId?: string | null
  enabled: boolean
}): Promise<ToolkitConnection | null> {
  const scopeCondition =
    input.scope === 'personal'
      ? and(
          eq(toolkitConnections.scope, 'personal'),
          eq(toolkitConnections.ownerUserId, input.ownerUserId ?? ''),
        )
      : eq(toolkitConnections.scope, 'shared')

  const [row] = await db
    .update(toolkitConnections)
    .set({ enabled: input.enabled, updatedAt: Date.now() })
    .where(
      and(
        eq(toolkitConnections.workspaceId, input.workspaceId),
        eq(toolkitConnections.toolkitName, input.toolkitName),
        scopeCondition,
      ),
    )
    .returning()
  return row ?? null
}

/**
 * Mark a connection as completed after Arcade reports the OAuth flow succeeded.
 * Clears any stored auth URL / flow id; sets `connectedAt`.
 */
export async function markConnectionCompleted(
  connectionId: string,
  options?: { arcadeUserId?: string },
): Promise<ToolkitConnection | null> {
  const now = Date.now()
  const [row] = await db
    .update(toolkitConnections)
    .set({
      authStatus: 'completed',
      authUrl: null,
      pendingFlowId: null,
      connectedAt: now,
      lastCheckedAt: now,
      updatedAt: now,
      ...(options?.arcadeUserId ? { arcadeUserId: options.arcadeUserId } : {}),
    })
    .where(eq(toolkitConnections.id, connectionId))
    .returning()
  return row ?? null
}

export async function touchConnectionLastChecked(connectionId: string): Promise<void> {
  const now = Date.now()
  await db
    .update(toolkitConnections)
    .set({ lastCheckedAt: now, updatedAt: now })
    .where(eq(toolkitConnections.id, connectionId))
}

/**
 * Reset a connection after an Arcade-side revoke. Keeps the row (so the user's
 * enabled/disabled preference is preserved for the toolkit if they reconnect),
 * but clears all auth state.
 */
export async function resetConnectionAfterRevoke(
  connectionId: string,
): Promise<ToolkitConnection | null> {
  const now = Date.now()
  const [row] = await db
    .update(toolkitConnections)
    .set({
      authStatus: 'unknown',
      authUrl: null,
      pendingFlowId: null,
      connectedAt: null,
      lastCheckedAt: now,
      updatedAt: now,
    })
    .where(eq(toolkitConnections.id, connectionId))
    .returning()
  return row ?? null
}

export async function markConnectionAuthorization(input: {
  connectionId: string
  authStatus: ConnectionAuthStatus
  authUrl?: string | null
  providerId?: string | null
  pendingFlowId?: string | null
  connectedAt?: number | null
}): Promise<ToolkitConnection | null> {
  const now = Date.now()
  const [row] = await db
    .update(toolkitConnections)
    .set({
      authStatus: input.authStatus,
      ...(input.authUrl !== undefined ? { authUrl: input.authUrl } : {}),
      ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
      ...(input.pendingFlowId !== undefined ? { pendingFlowId: input.pendingFlowId } : {}),
      ...(input.connectedAt !== undefined ? { connectedAt: input.connectedAt } : {}),
      lastCheckedAt: now,
      updatedAt: now,
    })
    .where(eq(toolkitConnections.id, input.connectionId))
    .returning()

  return row ?? null
}

export async function clearPendingFlow(input: {
  connectionId: string
  authStatus: ConnectionAuthStatus
  connectedAt?: number | null
}): Promise<ToolkitConnection | null> {
  const [row] = await db
    .update(toolkitConnections)
    .set({
      pendingFlowId: null,
      authUrl: null,
      oauthReturnTo: null,
      authStatus: input.authStatus,
      ...(input.connectedAt !== undefined ? { connectedAt: input.connectedAt } : {}),
      lastCheckedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(toolkitConnections.id, input.connectionId))
    .returning()
  return row ?? null
}

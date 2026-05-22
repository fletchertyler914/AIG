/**
 * Workspace queries — tenancy boundary for the execution plane.
 */

import { and, asc, eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { db } from '@/lib/db/client'
import { organization, type Workspace, type WorkspaceKind, workspaces } from '@/lib/db/schema'

export const DEFAULT_ORG_SLUG = 'default'
export const DEFAULT_WORKSPACE_SLUG = 'production'

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
  return row ?? null
}

export async function getWorkspaceForOrg(
  organizationId: string,
  slug: string,
): Promise<Workspace | null> {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.organizationId, organizationId), eq(workspaces.slug, slug)))
    .limit(1)
  return row ?? null
}

export async function listWorkspacesForOrg(organizationId: string): Promise<Workspace[]> {
  return db
    .select()
    .from(workspaces)
    .where(eq(workspaces.organizationId, organizationId))
    .orderBy(asc(workspaces.createdAt))
}

export async function createWorkspace(input: {
  organizationId: string
  name: string
  slug: string
  kind?: WorkspaceKind
  createdByUserId?: string | null
}): Promise<Workspace> {
  const [row] = await db
    .insert(workspaces)
    .values({
      id: ulid(),
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      kind: input.kind ?? 'production',
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning()
  if (!row) throw new Error('failed to create workspace')
  return row
}

/**
 * Ensures the seeded default org + production workspace exist.
 * Used for legacy/demo flows and for backfilling pre-tenancy intents.
 */
export async function ensureDefaultWorkspace(): Promise<Workspace> {
  let [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, DEFAULT_ORG_SLUG))
    .limit(1)

  if (!org) {
    const orgId = ulid()
    ;[org] = await db
      .insert(organization)
      .values({
        id: orgId,
        name: 'Default Organization',
        slug: DEFAULT_ORG_SLUG,
        createdAt: new Date(),
      })
      .returning()
    if (!org) throw new Error('failed to seed default organization')
  }

  const existing = await getWorkspaceForOrg(org.id, DEFAULT_WORKSPACE_SLUG)
  if (existing) return existing

  return createWorkspace({
    organizationId: org.id,
    name: 'Production',
    slug: DEFAULT_WORKSPACE_SLUG,
    kind: 'production',
  })
}

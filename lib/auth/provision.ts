/**
 * First-sign-in provisioning.
 *
 * When a user authenticates for the first time we create:
 *   1. A personal organization (slug derived from email)
 *   2. A production workspace inside it
 *
 * This gives every operator a ready-to-use tenant without manual setup.
 */

import { ulid } from 'ulid'
import { ensureSeedPipelineForWorkspace } from '@/lib/db/pipeline-queries'
import {
  findOrganizationIdForUser,
  insertOrganization,
  insertOrganizationMember,
  isOrganizationSlugTaken,
} from '@/lib/db/provision-queries'
import type { Workspace } from '@/lib/db/schema'
import { createWorkspace } from '@/lib/db/workspace-queries'

function slugifyEmail(email: string): string {
  const local = email.split('@')[0] ?? 'user'
  return local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export interface ProvisionedTenant {
  organizationId: string
  workspace: Workspace
}

/**
 * Idempotent: returns existing org/workspace if the user already has membership.
 */
export async function provisionTenantForUser(input: {
  userId: string
  email: string
  name: string
}): Promise<ProvisionedTenant> {
  const existingOrgId = await findOrganizationIdForUser(input.userId)

  if (existingOrgId) {
    const orgId = existingOrgId
    const { listWorkspacesForOrg } = await import('@/lib/db/workspace-queries')
    const workspaces = await listWorkspacesForOrg(orgId)
    const production = workspaces.find((w) => w.kind === 'production') ?? workspaces[0] ?? null

    if (production) {
      await ensureSeedPipelineForWorkspace({
        workspaceId: production.id,
        operatorEmail: input.email,
        createdByUserId: input.userId,
      })
      return { organizationId: orgId, workspace: production }
    }

    const created = await createWorkspace({
      organizationId: orgId,
      name: 'Production',
      slug: 'production',
      kind: 'production',
      createdByUserId: input.userId,
    })
    await ensureSeedPipelineForWorkspace({
      workspaceId: created.id,
      operatorEmail: input.email,
      createdByUserId: input.userId,
    })
    return { organizationId: orgId, workspace: created }
  }

  const baseSlug = slugifyEmail(input.email)
  let slug = baseSlug
  let attempt = 0

  while (attempt < 5) {
    if (!(await isOrganizationSlugTaken(slug))) break
    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }

  const orgId = ulid()
  await insertOrganization({
    id: orgId,
    name: `${input.name}'s workspace`,
    slug,
  })

  await insertOrganizationMember({
    id: ulid(),
    organizationId: orgId,
    userId: input.userId,
    role: 'owner',
  })

  const workspace = await createWorkspace({
    organizationId: orgId,
    name: 'Production',
    slug: 'production',
    kind: 'production',
    createdByUserId: input.userId,
  })

  await ensureSeedPipelineForWorkspace({
    workspaceId: workspace.id,
    operatorEmail: input.email,
    createdByUserId: input.userId,
  })

  return { organizationId: orgId, workspace }
}

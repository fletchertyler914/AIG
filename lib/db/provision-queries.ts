import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { member, organization } from '@/lib/db/schema'

export async function findOrganizationIdForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1)
  return row?.organizationId ?? null
}

export async function isOrganizationSlugTaken(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1)
  return Boolean(row)
}

export async function insertOrganization(input: {
  id: string
  name: string
  slug: string
}): Promise<void> {
  await db.insert(organization).values({
    id: input.id,
    name: input.name,
    slug: input.slug,
    createdAt: new Date(),
  })
}

export async function insertOrganizationMember(input: {
  id: string
  organizationId: string
  userId: string
  role: string
}): Promise<void> {
  await db.insert(member).values({
    id: input.id,
    organizationId: input.organizationId,
    userId: input.userId,
    role: input.role,
    createdAt: new Date(),
  })
}

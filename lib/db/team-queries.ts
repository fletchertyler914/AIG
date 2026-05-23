import { and, asc, eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { db } from '@/lib/db/client'
import { invitation, member, user } from '@/lib/db/schema'

export interface TeamMemberRow {
  id: string
  userId: string
  name: string
  email: string
  role: string
  createdAt: Date
}

export interface TeamInvitationRow {
  id: string
  email: string
  role: string | null
  status: string
  expiresAt: Date
  createdAt: Date
}

export async function listTeamMembers(organizationId: string): Promise<TeamMemberRow[]> {
  return db
    .select({
      id: member.id,
      userId: member.userId,
      name: user.name,
      email: user.email,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(member.createdAt))
}

export async function listTeamInvitations(organizationId: string): Promise<TeamInvitationRow[]> {
  return db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })
    .from(invitation)
    .where(eq(invitation.organizationId, organizationId))
    .orderBy(asc(invitation.createdAt))
}

export async function createTeamInvitation(input: {
  organizationId: string
  email: string
  role: 'member' | 'admin'
  inviterId: string
}): Promise<TeamInvitationRow> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const [row] = await db
    .insert(invitation)
    .values({
      id: ulid(),
      organizationId: input.organizationId,
      email: input.email,
      role: input.role,
      status: 'pending',
      expiresAt,
      createdAt: now,
      inviterId: input.inviterId,
    })
    .returning({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })

  if (!row) throw new Error('failed to create invitation')
  return row
}

export async function deleteTeamInvitation(input: {
  organizationId: string
  invitationId: string
}): Promise<boolean> {
  const rows = await db
    .delete(invitation)
    .where(
      and(
        eq(invitation.id, input.invitationId),
        eq(invitation.organizationId, input.organizationId),
      ),
    )
    .returning({ id: invitation.id })
  return rows.length > 0
}

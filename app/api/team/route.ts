import { z } from 'zod'
import { jsonError, jsonOk, messageFromUnknown, parseJson } from '@/lib/api/http'
import { canManageSharedConnections, resolveWorkspaceContext } from '@/lib/auth/session'
import { createTeamInvitation, listTeamInvitations, listTeamMembers } from '@/lib/db/team-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(['member', 'admin']).default('member'),
})

export interface TeamResponseDto {
  canManage: boolean
  members: Array<{
    id: string
    userId: string
    name: string
    email: string
    role: string
    createdAt: string
  }>
  invitations: Array<{
    id: string
    email: string
    role: string | null
    status: string
    expiresAt: string
    createdAt: string
  }>
}

export async function GET() {
  try {
    const ctx = await resolveWorkspaceContext()
    if (!ctx.organizationId) return jsonError('Organization not found', 404)

    const [members, invitations] = await Promise.all([
      listTeamMembers(ctx.organizationId),
      listTeamInvitations(ctx.organizationId),
    ])

    return jsonOk({
      canManage: canManageSharedConnections(ctx.memberRole),
      members: members.map((member) => ({
        ...member,
        createdAt: member.createdAt.toISOString(),
      })),
      invitations: invitations.map((invitation) => ({
        ...invitation,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      })),
    } satisfies TeamResponseDto)
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

export async function POST(request: Request) {
  try {
    const body = parseJson(inviteSchema, await request.json())
    const ctx = await resolveWorkspaceContext()
    if (!ctx.organizationId) return jsonError('Organization not found', 404)
    if (!canManageSharedConnections(ctx.memberRole)) {
      return jsonError('Only workspace owners and admins can invite teammates', 403)
    }
    if (ctx.userId === 'anonymous') return jsonError('Sign in to invite teammates', 401)

    const invitation = await createTeamInvitation({
      organizationId: ctx.organizationId,
      email: body.email,
      role: body.role,
      inviterId: ctx.userId,
    })

    return jsonOk(
      {
        invitation: {
          ...invitation,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

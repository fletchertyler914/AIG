import { jsonError, jsonOk, messageFromUnknown } from '@/lib/api/http'
import { canManageSharedConnections, resolveWorkspaceContext } from '@/lib/auth/session'
import { deleteTeamInvitation } from '@/lib/db/team-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const ctx = await resolveWorkspaceContext()
    if (!ctx.organizationId) return jsonError('Organization not found', 404)
    if (!canManageSharedConnections(ctx.memberRole)) {
      return jsonError('Only workspace owners and admins can manage invitations', 403)
    }

    const deleted = await deleteTeamInvitation({
      organizationId: ctx.organizationId,
      invitationId: id,
    })
    if (!deleted) return jsonError('Invitation not found', 404)

    return jsonOk({ deleted: true })
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

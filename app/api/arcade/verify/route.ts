import { redirect } from 'next/navigation'
import { arcadeIdentityForScope } from '@/lib/arcade/identity'
import { confirmArcadeUser } from '@/lib/arcade/verifier'
import { requireSession } from '@/lib/auth/session'
import { clearPendingFlow, getToolkitConnectionByPendingFlow } from '@/lib/db/connection-queries'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = logger.child({ route: 'GET /api/arcade/verify' })

/**
 * Arcade custom user verifier callback.
 *
 * Configure in Arcade Dashboard → Auth → Settings:
 * `${BETTER_AUTH_URL}/api/arcade/verify`
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const flowId = url.searchParams.get('flow_id')

  if (!flowId) {
    return redirect(`${env.BETTER_AUTH_URL}/app/connections?error=missing_flow_id`)
  }

  try {
    const session = await requireSession()
    const binding = await getToolkitConnectionByPendingFlow(flowId)

    if (!binding) {
      log.warn({ flowId }, 'no pending flow binding found')
      return redirect(`${env.BETTER_AUTH_URL}/app/connections?error=unknown_flow`)
    }

    const identity = arcadeIdentityForScope({
      scope: binding.scope,
      userId: session.user.id,
      workspaceId: binding.workspaceId,
    })

    if (binding.scope === 'personal' && binding.ownerUserId !== session.user.id) {
      log.warn(
        { flowId, ownerUserId: binding.ownerUserId, sessionUserId: session.user.id },
        'personal flow user mismatch',
      )
      return redirect(`${env.BETTER_AUTH_URL}/app/connections?error=user_mismatch`)
    }

    const result = await confirmArcadeUser({ flowId, identity })

    await clearPendingFlow({
      connectionId: binding.id,
      authStatus: 'completed',
      connectedAt: Date.now(),
    })

    const destination = result.nextUri ?? `${env.BETTER_AUTH_URL}/app/connections?connected=1`
    return redirect(destination)
  } catch (error) {
    log.error({ err: error, flowId }, 'arcade verifier failed')
    return redirect(`${env.BETTER_AUTH_URL}/app/connections?error=verify_failed`)
  }
}

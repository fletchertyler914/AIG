import { jsonError, jsonOk, messageFromUnknown } from '@/lib/api/http'
import { getAuthProviderReadiness } from '@/lib/arcade/auth-providers'
import { canManageSharedConnections, resolveWorkspaceContext } from '@/lib/auth/session'
import { getArcadeVerifierMode, getPublicAppOrigin } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export interface AuthProviderReadinessDto {
  catalog: Array<{
    id: string
    name: string
    description: string
    docsUrl: string
    configured: boolean
  }>
  configured: Array<{
    id: string
    providerId: string | null
    description: string | null
    status: string | null
    redirectUri: string | null
  }>
  configuredCount: number
  missingCount: number
  verifierMode: 'arcade' | 'custom'
  customVerifierUrl: string
  arcadeDashboardUrl: string
}

/**
 * OAuth provider readiness for workspace admins.
 * Lists all Arcade provider families and which are registered in the project.
 */
export async function GET(request: Request) {
  try {
    const ctx = await resolveWorkspaceContext()
    if (!canManageSharedConnections(ctx.memberRole)) {
      return jsonError('Only workspace owners and admins can view auth provider setup', 403)
    }

    const url = new URL(request.url)
    const force = url.searchParams.get('refresh') === '1'
    const readiness = await getAuthProviderReadiness({ force })

    const configuredSet = new Set(readiness.configuredProviderIds)

    const body: AuthProviderReadinessDto = {
      catalog: readiness.catalog.map((entry) => ({
        ...entry,
        configured: configuredSet.has(entry.id),
      })),
      configured: readiness.configured,
      configuredCount: readiness.configuredProviderIds.length,
      missingCount: readiness.missingProviderIds.length,
      verifierMode: getArcadeVerifierMode(),
      customVerifierUrl: `${getPublicAppOrigin()}/api/arcade/verify`,
      arcadeDashboardUrl: 'https://api.arcade.dev/dashboard/auth/settings',
    }

    return jsonOk(body)
  } catch (error) {
    return jsonError(messageFromUnknown(error), 400)
  }
}

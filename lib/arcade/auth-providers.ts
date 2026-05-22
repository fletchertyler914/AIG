/**
 * Arcade OAuth provider readiness — lists configured providers via Admin API.
 */

import {
  ARCADE_AUTH_PROVIDER_CATALOG,
  type AuthProviderCatalogEntry,
} from '@/lib/display/auth-providers'
import { isArcadeMocked } from '@/lib/env'
import { getArcadeClient } from './client'

export interface ConfiguredAuthProvider {
  /** Provider instance id in Arcade (unique per registration). */
  id: string
  providerId: string | null
  description: string | null
  status: string | null
  redirectUri: string | null
}

export interface AuthProviderReadiness {
  catalog: AuthProviderCatalogEntry[]
  configured: ConfiguredAuthProvider[]
  configuredProviderIds: string[]
  missingProviderIds: string[]
}

const CACHE_TTL_MS = 5 * 60_000

let cache: { expiresAt: number; readiness: AuthProviderReadiness } | undefined

const MOCK_CONFIGURED: ConfiguredAuthProvider[] = [
  {
    id: 'mock-google',
    providerId: 'google',
    description: 'Mock Google provider',
    status: 'active',
    redirectUri: 'https://api.arcade.dev/v1/oauth/callback',
  },
  {
    id: 'mock-github',
    providerId: 'github',
    description: 'Mock GitHub provider',
    status: 'active',
    redirectUri: 'https://api.arcade.dev/v1/oauth/callback',
  },
]

export async function getAuthProviderReadiness(options?: {
  force?: boolean
}): Promise<AuthProviderReadiness> {
  if (isArcadeMocked) return buildReadiness(MOCK_CONFIGURED)

  const now = Date.now()
  if (!options?.force && cache && cache.expiresAt > now) {
    return cache.readiness
  }

  const arcade = getArcadeClient()
  const res = await arcade.admin.authProviders.list()
  const configured = (res.items ?? []).map(normalizeConfiguredProvider)
  const readiness = buildReadiness(configured)

  cache = { expiresAt: now + CACHE_TTL_MS, readiness }
  return readiness
}

export async function listConfiguredProviderIds(options?: { force?: boolean }): Promise<string[]> {
  const readiness = await getAuthProviderReadiness(options)
  return readiness.configuredProviderIds
}

function buildReadiness(configured: ConfiguredAuthProvider[]): AuthProviderReadiness {
  const configuredProviderIds = [
    ...new Set(
      configured
        .map((row) => row.providerId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ]

  const configuredSet = new Set(configuredProviderIds)
  const missingProviderIds = ARCADE_AUTH_PROVIDER_CATALOG.map((entry) => entry.id).filter(
    (id) => !configuredSet.has(id),
  )

  return {
    catalog: ARCADE_AUTH_PROVIDER_CATALOG,
    configured,
    configuredProviderIds,
    missingProviderIds,
  }
}

function normalizeConfiguredProvider(row: {
  id?: string
  provider_id?: string
  description?: string
  status?: string
  oauth2?: { redirect_uri?: string }
}): ConfiguredAuthProvider {
  return {
    id: row.id ?? 'unknown',
    providerId: row.provider_id ?? null,
    description: row.description ?? null,
    status: row.status ?? null,
    redirectUri: row.oauth2?.redirect_uri ?? null,
  }
}

/** Test helper — clears in-memory cache between cases. */
export function resetAuthProviderCacheForTests(): void {
  cache = undefined
}

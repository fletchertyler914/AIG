/**
 * Validate operator return paths after Arcade OAuth.
 * Pure — safe for routes and unit tests.
 */

export function resolveOAuthReturnTo(input: {
  appOrigin: string
  returnTo?: string | undefined
  fallbackPath?: string
}): string {
  const fallbackPath = input.fallbackPath ?? '/app/connections'
  const fallback = `${input.appOrigin.replace(/\/$/, '')}${fallbackPath}`

  if (!input.returnTo?.trim()) return fallback

  try {
    const base = new URL(input.appOrigin)
    const url = new URL(input.returnTo, base)
    if (url.origin !== base.origin || !url.pathname.startsWith('/app/')) {
      return fallback
    }
    return url.toString()
  } catch {
    return fallback
  }
}

import { jsonError, jsonOk } from '@/lib/api/http'
import { getCapturedMagicLink } from '@/lib/email/magic-link'
import { isE2eCaptureMagicLink } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Test-only helper — returns the last captured magic-link URL for an email.
 * Enabled when E2E_CAPTURE_MAGIC_LINK=1 (Playwright auth project).
 */
export async function GET(request: Request) {
  if (!isE2eCaptureMagicLink) {
    return jsonError('Not found', 404)
  }

  const email = new URL(request.url).searchParams.get('email')?.trim().toLowerCase()
  if (!email) return jsonError('email query param required', 400)

  const url = getCapturedMagicLink(email)
  if (!url) return jsonError('No magic link captured for this email yet', 404)

  return jsonOk({ email, url })
}

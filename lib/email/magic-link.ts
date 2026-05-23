/**
 * Magic-link email delivery.
 *
 * In production: Resend.
 * In development (no RESEND_API_KEY): logs the link to stdout so you can
 * click it without configuring email. This keeps onboarding friction at zero.
 */

import { Resend } from 'resend'
import { env, isDevelopment, isE2eCaptureMagicLink } from '@/lib/env'
import { logger } from '@/lib/logger'
import { renderMagicLinkHtml, renderMagicLinkText } from './templates/magic-link'

interface SendMagicLinkArgs {
  to: string
  url: string
  token: string
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

const capturedLinks = new Map<string, string>()

export function getCapturedMagicLink(email: string): string | null {
  return capturedLinks.get(email.toLowerCase()) ?? null
}

export function clearCapturedMagicLinksForTests(): void {
  capturedLinks.clear()
}

export async function sendMagicLinkEmail({ to, url, token }: SendMagicLinkArgs): Promise<void> {
  const subject = 'Your AIG sign-in link'
  const [html, text] = await Promise.all([
    renderMagicLinkHtml({ url }),
    renderMagicLinkText({ url }),
  ])

  if (!resend) {
    if (isDevelopment || isE2eCaptureMagicLink) {
      capturedLinks.set(to.toLowerCase(), url)
      logger.info(
        { to, url, token, hint: 'set RESEND_API_KEY to deliver real emails' },
        '[dev] magic-link (open URL in browser to sign in)',
      )
      // biome-ignore lint/suspicious/noConsole: dev-only convenience
      console.log(`\n  ➜ Magic link for ${to}:\n    ${url}\n`)
      return
    }
    throw new Error('RESEND_API_KEY is required to deliver magic-link emails outside development')
  }

  const result = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  })

  if (result.error) {
    logger.error({ to, error: result.error }, 'resend rejected magic-link delivery')
    throw new Error(`Failed to send magic-link email: ${result.error.message}`)
  }

  logger.info({ to, emailId: result.data?.id }, 'magic-link delivered')
}

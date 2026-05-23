import { expect } from '@playwright/test'

const E2E_USER_EMAIL = process.env['E2E_USER_EMAIL'] ?? 'e2e@aig.test'

/**
 * Sign in via captured magic link (requires E2E_CAPTURE_MAGIC_LINK=1 on the server).
 */
export async function signInWithMagicLink(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel(/email/i).fill(E2E_USER_EMAIL)
  await page.getByRole('button', { name: /send|sign/i }).click()

  const res = await page.request.get(
    `/api/test/magic-link?email=${encodeURIComponent(E2E_USER_EMAIL)}`,
  )
  expect(res.ok()).toBeTruthy()
  const body = (await res.json()) as { url: string }
  await page.goto(body.url)
  await page.waitForURL(/\/app/)
}

export { E2E_USER_EMAIL }

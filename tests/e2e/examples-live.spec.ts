/**
 * Opt-in local E2E for the real example prompts on the dashboard.
 *
 * This intentionally calls the real plan-agent route, so it is not part of
 * the default Playwright suite. Run with:
 *
 *   RUN_LIVE_EXAMPLES=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
 *     pnpm exec playwright test tests/e2e/examples-live.spec.ts
 */

import { expect, test } from '@playwright/test'

const runLive = process.env['RUN_LIVE_EXAMPLES'] === '1'

test.describe('dashboard examples (live plan agent)', () => {
  test.skip(!runLive, 'set RUN_LIVE_EXAMPLES=1 to run live example prompts')
  test.setTimeout(120_000)

  test('each example chip creates an intent', async ({ page }) => {
    await page.goto('/app')
    const examples = page.getByTestId('example-prompt')
    const count = await examples.count()
    expect(count).toBeGreaterThan(0)

    for (let index = 0; index < count; index += 1) {
      await page.goto('/app')
      const example = page.getByTestId('example-prompt').nth(index)
      const label = await example.textContent()

      await example.click()
      await expect(page.getByTestId('plan-prompt')).not.toHaveValue('')
      await page.getByTestId('run-plan').click()

      await page.waitForURL(/\/app\/intent\/[0-9A-HJKMNP-TV-Z]{26}$/, {
        timeout: 70_000,
        waitUntil: 'networkidle',
      })

      await expect(page.getByTestId('intent-label'), `example: ${label}`).toBeVisible()
      await expect(page.getByTestId('tool-call-card').first(), `example: ${label}`).toBeVisible()
    }
  })
})

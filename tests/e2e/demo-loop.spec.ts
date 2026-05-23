/**
 * End-to-end coverage of the AIG demo loop.
 *
 * Path:
 *   1. Click "or replay the locked demo" on the dashboard
 *   2. Detail page loads with PENDING_REVIEW + locked objective + tool calls
 *   3. Select a GoogleCalendar node and click "Remove" in the side panel
 *   4. Trace shows: agent_proposed → human_removed → system_invalidated → agent_regenerated
 *   5. Click "Approve intent" (triggers Arcade execution — mocked here)
 *   6. Trace adds: human_approved → arcade_executed × N → status = COMPLETE
 *
 * Arcade calls are short-circuited by E2E_MOCK_ARCADE=1, set in
 * playwright.config.ts. This validates the UI, state machine, repair
 * engine, executor, and SSE refresh — every layer except real Arcade.
 */

import { expect, test } from '@playwright/test'

test.describe('AIG demo loop', () => {
  test('create → mutate → repair → approve → execute', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/app')

    await page.getByTestId('run-demo').click()
    await page.waitForURL(/\/intent\/.+/)

    const label = page.getByTestId('intent-label')
    await expect(label).toContainText(/lead follow-up/i)

    await expect(page.getByTestId('intent-status')).toHaveText('PENDING REVIEW')
    await expect(page.getByText('Locked objective:')).toBeVisible()

    await page.getByTestId('view-list').click()

    const calendarCards = page.locator('[data-testid="tool-call-card"][data-tool*="Calendar"]')
    const cardsCount = await calendarCards.count()
    expect(cardsCount).toBeGreaterThan(0)

    await calendarCards.first().click()
    await expect(page.getByTestId('tool-call-remove')).toBeVisible()

    const mutateResponse = page.waitForResponse((response) => response.url().includes('/mutate'))
    await page.getByTestId('tool-call-remove').click()
    const mutate = await mutateResponse
    expect(mutate.ok()).toBeTruthy()

    await page.getByRole('button', { name: 'Expand trace' }).click()

    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="human_removed"]'),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="system_invalidated"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="agent_regenerated"]'),
    ).toBeVisible()

    await expect(page.getByTestId('intent-status')).toHaveText('PENDING REVIEW', {
      timeout: 15_000,
    })

    const approveResponse = page.waitForResponse((response) => response.url().includes('/approve'))
    await page.getByTestId('approve-button').click()
    const approve = await approveResponse
    if (!approve.ok()) {
      throw new Error(`Approve failed: ${approve.status()} ${await approve.text()}`)
    }

    await expect(page.getByTestId('intent-status')).toHaveText('COMPLETE', { timeout: 30_000 })
    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="human_approved"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="arcade_executed"]').first(),
    ).toBeVisible()
  })
})

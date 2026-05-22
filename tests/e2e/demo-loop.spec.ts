/**
 * End-to-end coverage of the AIG demo loop.
 *
 * Path:
 *   1. Click "or replay the locked demo" on the dashboard
 *   2. Detail page loads with PENDING_REVIEW + locked objective + tool calls
 *   3. Click "Remove" on a GoogleCalendar.CreateEvent card
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

    await page.goto('/')

    await page.getByTestId('run-demo').click()
    await page.waitForURL(/\/intent\/.+/)

    const label = page.getByTestId('intent-label')
    await expect(label).toContainText(/lead follow-up/i)

    await expect(page.getByTestId('intent-status')).toHaveText('PENDING_REVIEW')
    await expect(page.getByText('Locked objective:')).toBeVisible()

    const calendarCards = page.locator('[data-testid="tool-call-card"][data-tool*="Calendar"]')
    const cardsCount = await calendarCards.count()
    expect(cardsCount).toBeGreaterThan(0)

    const targetCard = calendarCards.first()
    await targetCard.getByTestId('tool-call-remove').click()

    await expect(page.getByTestId('trace-entry')).toHaveCount(4, { timeout: 15_000 })
    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="human_removed"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="system_invalidated"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="agent_regenerated"]'),
    ).toBeVisible()

    await expect(page.getByTestId('intent-status')).toHaveText('PENDING_REVIEW', {
      timeout: 15_000,
    })

    await page.getByTestId('approve-button').click()

    await expect(page.getByTestId('intent-status')).toHaveText('COMPLETE', { timeout: 30_000 })
    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="human_approved"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="trace-entry"][data-event-type="arcade_executed"]').first(),
    ).toBeVisible()
  })
})

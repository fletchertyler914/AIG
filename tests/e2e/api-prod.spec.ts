/**
 * Production-build smoke tests for API routes that depend on resources
 * which historically were not bundled correctly into the serverless
 * lambda (e.g. system prompt files).
 *
 * Run this against a `next start` build (which Vercel uses) — NOT just
 * `next dev`. The `pnpm test:e2e:prod` script enforces that by setting
 * PLAYWRIGHT_USE_PROD_BUILD=1.
 *
 * Arcade is still mocked here (we won't send real emails from CI), but
 * everything else — module loading, file imports, plan-agent execution
 * with a stub Claude — runs through the production code path.
 */

import { expect, test } from '@playwright/test'

test.describe('production build smoke', () => {
  test('GET /api/intents responds without 500', async ({ request }) => {
    const res = await request.get('/api/intents')
    expect(res.status(), `body: ${await res.text()}`).toBe(200)
    const body = (await res.json()) as { intents: unknown[] }
    expect(Array.isArray(body.intents)).toBe(true)
  })

  test('POST /api/intents/demo returns 201 with an intent id', async ({ request }) => {
    const res = await request.post('/api/intents/demo')
    expect(res.status(), `body: ${await res.text()}`).toBe(201)
    const body = (await res.json()) as { intentId: string; toolCallIds: string[] }
    expect(body.intentId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(body.toolCallIds.length).toBeGreaterThan(0)
  })

  test('plan-agent route does not crash on module load (no ENOENT)', async ({ request }) => {
    // We don't assert success because the LLM may fail without keys; we
    // only assert the failure is not a 500 from a missing module / file.
    // In E2E with mocked Arcade + dev Anthropic key absent, the route
    // returns either 201 (real plan) or 4xx (validation/api). It MUST
    // NOT return a 500 from ENOENT-style module load failures.
    const res = await request.post('/api/intents', {
      data: { prompt: 'noop smoke test' },
    })
    const text = await res.text()
    expect(text, 'must not surface ENOENT from bundling').not.toMatch(/ENOENT|no such file/i)
    expect(res.status(), `body: ${text}`).toBeLessThan(500)
  })

  test('POST /api/intents accepts prompts that imply unconnected toolkits', async ({ request }) => {
    // Regression: AIG is plan-before-execute, so missing OAuth (or even
    // missing workspace-level enablement) must NOT block intent creation.
    // The plan agent auto-enables inferred toolkits and the resulting
    // intent renders AUTH REQUIRED per tool-call node. The pre-fix code
    // returned a 400 "Connect Gmail and GoogleCalendar before creating
    // this intent." — this test ensures we never re-introduce that gate.
    const res = await request.post('/api/intents', {
      data: {
        prompt:
          'Email a concise AIG launch update to demo@example.com and create a 15-minute calendar reminder for tomorrow at 9am.',
      },
    })
    const text = await res.text()

    expect(text, 'must not require pre-auth at planning time').not.toMatch(
      /Connect .* before creating this intent/i,
    )
    expect(res.status(), `body: ${text}`).toBeLessThan(500)

    if (res.status() === 201) {
      const body = (await res.json()) as { intentId: string; toolCallIds: string[] }
      expect(body.intentId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    }
  })
})

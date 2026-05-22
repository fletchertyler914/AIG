/**
 * Repair eval harness — THE GATE before Phase 3.
 *
 * EVAL_MODE=mock  → canned responses in eval/mocks/ (CI-safe)
 * EVAL_MODE=live  → real Claude calls (must pass 9/9 × 3 consecutive runs)
 */

import { describe, expect, it } from 'vitest'
import { repairIntent } from '@/lib/aig/repair'
import { CASE_IDS, loadFixture, runFixture } from './helpers'

const mode = process.env['EVAL_MODE'] ?? 'mock'
const isLive = mode === 'live'

describe(`repair eval [${mode}]`, () => {
  for (const caseId of CASE_IDS) {
    it(`${caseId}: contract + fixture invariants`, async () => {
      const fixture = loadFixture(caseId)

      if (isLive) {
        const response = await repairIntent(fixture.input)
        // Live mode: assert structural invariants, not exact mock match.
        expect(response.preserve).toEqual(expect.arrayContaining([]))
        for (const locked of fixture.input.lockedNodes) {
          expect(response.preserve).toContain(locked.id)
        }
        for (const inv of fixture.input.invalidatedNodes) {
          expect(response.remove).toContain(inv.id)
        }
        const humanEdited = [...fixture.input.lockedNodes, ...fixture.input.preservedNodes].filter(
          (n) => n.humanEdited,
        )
        for (const node of humanEdited) {
          expect(response.preserve).toContain(node.id)
        }
        return
      }

      const response = await runFixture(fixture)
      expect(response).toEqual(fixture.mockResponse)

      // Case-specific invariants beyond exact mock equality in mock mode.
      if (caseId === 'case-09') {
        expect(response.preserve).toContain('tc_email_acme')
        const acme = fixture.input.preservedNodes.find((n) => n.id === 'tc_email_acme')
        expect(acme?.args['body']).toBe(
          'EXACT_HUMAN_EDIT: Please find time for a brief intro — no pressure.',
        )
      }

      if (caseId === 'case-06') {
        expect(response.replace).toHaveLength(0)
        expect(response.preserve).toEqual(['tc_email'])
      }

      if (caseId === 'case-05' || caseId === 'case-03') {
        expect(response.replace.length).toBeGreaterThan(0)
        const slack = response.replace.find((r) => r.tool.includes('Slack'))
        expect(slack).toBeDefined()
        expect(slack?.args['text']).not.toMatch(/Globex intro call/i)
      }
    })
  }
})

describe('repair contract violations', () => {
  it('rejects removing a locked node from preserve', async () => {
    const fixture = loadFixture('case-06')
    const bad = { ...fixture.mockResponse, preserve: [] }
    await expect(repairIntent(fixture.input, { mockResponse: bad })).rejects.toThrow(
      /locked node tc_email/,
    )
  })

  it('rejects preserving an invalidated node', async () => {
    const fixture = loadFixture('case-04')
    const bad = {
      ...fixture.mockResponse,
      preserve: ['tc_email', 'tc_cal', 'tc_slack'],
      remove: [],
    }
    await expect(repairIntent(fixture.input, { mockResponse: bad })).rejects.toThrow(
      /invalidated node tc_slack/,
    )
  })
})

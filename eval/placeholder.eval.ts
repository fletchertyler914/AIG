import { describe, expect, it } from 'vitest'

describe('eval harness placeholder', () => {
  it('runs', () => {
    expect(process.env['EVAL_MODE'] ?? 'mock').toMatch(/^(mock|live)$/)
  })
})

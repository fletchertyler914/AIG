import { describe, expect, it } from 'vitest'
import { runPlanAgent } from '@/lib/ai/plan-agent'

describe('runPlanAgent (mock mode)', () => {
  it('returns captured calls in order with a fresh window id', async () => {
    const result = await runPlanAgent({
      prompt: 'doesnt matter — mocked',
      userId: 'tester@example.com',
      toolkits: ['Gmail'],
      mock: {
        text: 'Proposed two emails.',
        calls: [
          {
            tool: 'Gmail.SendEmail@7.0.0',
            args: { recipient: 'a@example.com', subject: 'A', body: 'body A' },
          },
          {
            tool: 'Gmail.SendEmail@7.0.0',
            args: { recipient: 'b@example.com', subject: 'B', body: 'body B' },
          },
        ],
      },
    })

    expect(result.calls).toHaveLength(2)
    expect(result.calls[0]?.tool).toBe('Gmail.SendEmail@7.0.0')
    expect(result.calls[1]?.args).toMatchObject({ recipient: 'b@example.com' })
    expect(result.text).toBe('Proposed two emails.')
    expect(result.windowId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(result.calls.every((c) => c.windowId === result.windowId)).toBe(true)
  })

  it('returns empty calls list when mock provides none', async () => {
    const result = await runPlanAgent({
      prompt: 'no-op',
      userId: 'tester@example.com',
      toolkits: ['Gmail'],
      mock: { calls: [] },
    })
    expect(result.calls).toHaveLength(0)
    expect(result.text).toBe('')
  })

  it('produces strictly monotonically increasing capturedAt timestamps', async () => {
    const result = await runPlanAgent({
      prompt: 'x',
      userId: 'tester@example.com',
      toolkits: ['Gmail'],
      mock: {
        calls: Array.from({ length: 5 }, (_, i) => ({
          tool: 'Gmail.SendEmail@7.0.0',
          args: { recipient: `t${i}@example.com`, subject: 'x', body: 'x' },
        })),
      },
    })
    for (let i = 1; i < result.calls.length; i++) {
      const prev = result.calls[i - 1]
      const curr = result.calls[i]
      if (!prev || !curr) throw new Error('expected captured calls')
      expect(curr.capturedAt).toBeGreaterThan(prev.capturedAt)
    }
  })
})

import { describe, expect, it, vi } from 'vitest'
import { authorizeMany, hasPendingAuthorizations } from '@/lib/arcade/authorize'
import { personalArcadeIdentity } from '@/lib/arcade/identity'

const personal = personalArcadeIdentity('tester-1')

describe('authorizeMany', () => {
  it('dedupes tool names by first appearance and preserves order', async () => {
    const calls: string[] = []
    const authorizer = vi.fn(
      async ({ tool, identity: id }: { tool: string; identity: { kind: string } }) => {
        calls.push(tool)
        expect(id.kind).toBe('personal')
        return { tool, status: 'completed' as const }
      },
    )

    const result = await authorizeMany(
      [
        'Gmail.SendEmail@7.0.0',
        'GoogleCalendar.CreateEvent@3.3.2',
        'Gmail.SendEmail@7.0.0',
        'Gmail.SendEmail@7.0.0',
      ],
      personal,
      { authorizer },
    )

    expect(authorizer).toHaveBeenCalledTimes(2)
    expect(calls).toEqual(['Gmail.SendEmail@7.0.0', 'GoogleCalendar.CreateEvent@3.3.2'])
    expect(result.map((r) => r.tool)).toEqual([
      'Gmail.SendEmail@7.0.0',
      'GoogleCalendar.CreateEvent@3.3.2',
    ])
  })

  it('surfaces pending authorizations with url + providerId', async () => {
    const result = await authorizeMany(['Gmail.SendEmail@7.0.0'], personal, {
      authorizer: async () => ({
        tool: 'Gmail.SendEmail@7.0.0',
        status: 'pending',
        url: 'https://arcade.dev/oauth/google?token=abc',
        providerId: 'google',
      }),
    })

    expect(result[0]?.status).toBe('pending')
    expect(result[0]?.url).toContain('arcade.dev/oauth')
    expect(hasPendingAuthorizations(result)).toBe(true)
  })

  it('hasPendingAuthorizations is false when all completed', () => {
    expect(
      hasPendingAuthorizations([
        { tool: 'A', status: 'completed' },
        { tool: 'B', status: 'completed' },
      ]),
    ).toBe(false)
  })
})

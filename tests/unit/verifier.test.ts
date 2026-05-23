import { afterEach, describe, expect, it, vi } from 'vitest'

// confirmArcadeUser is only used in custom verifier mode. Pin the env so the
// identity resolver produces the prefixed `user:{id}` form regardless of the
// suite's default mode (ADR-0010 single-project default is `arcade`).
const originalMode = process.env['ARCADE_VERIFIER_MODE']
process.env['ARCADE_VERIFIER_MODE'] = 'custom'

vi.mock('@/lib/arcade/client', () => ({
  getArcadeClient: () => ({
    auth: {
      confirmUser: vi.fn(async ({ flow_id, user_id }: { flow_id: string; user_id: string }) => ({
        auth_id: 'auth_123',
        next_uri: `https://app.test/connections?flow=${flow_id}&user=${user_id}`,
      })),
    },
  }),
}))

afterEach(() => {
  if (originalMode === undefined) delete process.env['ARCADE_VERIFIER_MODE']
  else process.env['ARCADE_VERIFIER_MODE'] = originalMode
})

describe('confirmArcadeUser', () => {
  it('calls auth.confirmUser with stable arcade user id', async () => {
    const { personalArcadeIdentity } = await import('@/lib/arcade/identity')
    const { confirmArcadeUser } = await import('@/lib/arcade/verifier')

    const result = await confirmArcadeUser({
      flowId: 'flow-abc',
      identity: personalArcadeIdentity('user-1'),
    })

    expect(result.authId).toBe('auth_123')
    expect(result.nextUri).toContain('flow-abc')
    expect(result.nextUri).toContain('user:user-1')
  })
})

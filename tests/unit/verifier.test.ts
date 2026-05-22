import { describe, expect, it, vi } from 'vitest'
import { personalArcadeIdentity } from '@/lib/arcade/identity'
import { confirmArcadeUser } from '@/lib/arcade/verifier'

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

describe('confirmArcadeUser', () => {
  it('calls auth.confirmUser with stable arcade user id', async () => {
    const result = await confirmArcadeUser({
      flowId: 'flow-abc',
      identity: personalArcadeIdentity('user-1'),
    })

    expect(result.authId).toBe('auth_123')
    expect(result.nextUri).toContain('flow-abc')
    expect(result.nextUri).toContain('user:user-1')
  })
})

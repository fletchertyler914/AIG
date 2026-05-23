import { beforeEach, describe, expect, it, vi } from 'vitest'
import { personalArcadeIdentity } from '@/lib/arcade/identity'

const authorizeMock = vi.fn()

vi.mock('@/lib/arcade/client', () => ({
  getArcadeClient: () => ({
    tools: {
      authorize: authorizeMock,
    },
  }),
}))

vi.mock('@/lib/env', () => ({
  isArcadeMocked: false,
  getArcadeVerifierMode: () => 'custom',
}))

describe('authorizeToolkit', () => {
  beforeEach(() => {
    authorizeMock.mockReset()
    authorizeMock.mockResolvedValue({
      status: 'pending',
      url: 'https://accounts.google.com/o/oauth2/v2/auth?flow_id=flow-123',
      provider_id: 'google',
    })
  })

  it('never sends next_uri to Arcade', async () => {
    const { authorizeToolkit } = await import('@/lib/arcade/authorize')

    await authorizeToolkit({
      toolkitName: 'GoogleCalendar',
      representativeTool: 'GoogleCalendar.CreateEvent@3.3.2',
      identity: personalArcadeIdentity('usr_01', 'dev@example.com'),
      returnTo: '/app/connections',
    })

    expect(authorizeMock).toHaveBeenCalledWith({
      tool_name: 'GoogleCalendar.CreateEvent',
      tool_version: '3.3.2',
      user_id: 'user:usr_01',
    })
    expect(authorizeMock.mock.calls[0]?.[0]).not.toHaveProperty('next_uri')
  })
})

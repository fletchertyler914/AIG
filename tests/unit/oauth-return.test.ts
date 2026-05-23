import { describe, expect, it } from 'vitest'
import { resolveOAuthReturnTo } from '@/lib/display/oauth-return'

describe('resolveOAuthReturnTo', () => {
  const origin = 'https://arcadeintentgraph.xyz'

  it('uses the connections fallback when returnTo is missing', () => {
    expect(resolveOAuthReturnTo({ appOrigin: origin })).toBe(
      'https://arcadeintentgraph.xyz/app/connections',
    )
  })

  it('accepts same-origin app paths', () => {
    expect(
      resolveOAuthReturnTo({
        appOrigin: origin,
        returnTo: '/app/intent/abc123',
      }),
    ).toBe('https://arcadeintentgraph.xyz/app/intent/abc123')
  })

  it('rejects external origins', () => {
    expect(
      resolveOAuthReturnTo({
        appOrigin: origin,
        returnTo: 'https://evil.example/app/connections',
      }),
    ).toBe('https://arcadeintentgraph.xyz/app/connections')
  })

  it('rejects non-app paths', () => {
    expect(
      resolveOAuthReturnTo({
        appOrigin: origin,
        returnTo: '/sign-in',
      }),
    ).toBe('https://arcadeintentgraph.xyz/app/connections')
  })
})

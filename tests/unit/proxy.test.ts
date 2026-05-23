import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from '@/proxy'

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`https://arcadeintentgraph.xyz${path}`, {
    ...(cookie ? { headers: { cookie } } : {}),
  })
}

describe('proxy auth gate', () => {
  it('redirects protected app routes without a session cookie', () => {
    const res = proxy(request('/app'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'https://arcadeintentgraph.xyz/sign-in?callbackUrl=%2Fapp',
    )
  })

  it('allows production __Secure-prefixed Better Auth session cookies', () => {
    const res = proxy(request('/app', '__Secure-aig.session_token=session-token'))

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('allows local unprefixed Better Auth session cookies', () => {
    const res = proxy(request('/app', 'aig.session_token=session-token'))

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })
})

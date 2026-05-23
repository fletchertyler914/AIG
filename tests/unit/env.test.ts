import { afterEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

afterEach(() => {
  vi.resetModules()
  process.env = { ...originalEnv }
})

describe('getPublicAppOrigin', () => {
  it('uses BETTER_AUTH_URL outside Vercel previews', async () => {
    process.env['BETTER_AUTH_URL'] = 'https://arcadeintentgraph.xyz/'
    process.env['VERCEL_ENV'] = 'production'
    process.env['VERCEL_URL'] = 'aig-production.vercel.app'

    const { getPublicAppOrigin } = await import('@/lib/env')

    expect(getPublicAppOrigin()).toBe('https://arcadeintentgraph.xyz')
  })

  it('uses the deployment hostname for Vercel previews', async () => {
    process.env['BETTER_AUTH_URL'] = 'https://arcadeintentgraph.xyz'
    process.env['VERCEL_ENV'] = 'preview'
    process.env['VERCEL_URL'] = 'aig-git-feature-team.vercel.app'

    const { getPublicAppOrigin } = await import('@/lib/env')

    expect(getPublicAppOrigin()).toBe('https://aig-git-feature-team.vercel.app')
  })
})

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Boundary rules are implemented in scripts/check-boundaries.ts.
 * These tests guard representative cases so refactors don't silently weaken CI.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8')
}

describe('module boundaries (smoke)', () => {
  it('keeps @arcadeai/arcadejs inside lib/arcade', () => {
    const client = read('lib/arcade/client.ts')
    expect(client).toContain('@arcadeai/arcadejs')
    const component = read('components/intent/intent-detail-client.tsx')
    expect(component).not.toContain('@arcadeai/arcadejs')
    expect(component).not.toContain('@/lib/arcade/')
  })

  it('keeps display helpers outside lib/arcade for UI imports', () => {
    const detail = read('components/intent/intent-detail-client.tsx')
    expect(detail).toContain('@/lib/display/toolkits')
  })

  it('routes env flags through lib/env in arcade wrappers', () => {
    expect(read('lib/arcade/tools.ts')).toContain('isArcadeMocked')
    expect(read('lib/arcade/tools.ts')).not.toMatch(/process\.env\[['"]E2E_MOCK_ARCADE/)
  })
})

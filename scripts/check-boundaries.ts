/**
 * Module boundary enforcement for AIG.
 *
 * Mirrors `.cursor/rules/00-architecture.mdc` and `AGENTS.md` §3.
 * Run via `pnpm check:boundaries` (CI + pre-push).
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

const IGNORE_DIRS = new Set(['.git', '.next', 'node_modules', 'coverage', 'dist', 'out'])

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx'])

interface Violation {
  file: string
  rule: string
  detail: string
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<STARSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<STARSTAR>>>/g, '.*')
  return new RegExp(`^${escaped}$`)
}

function matchesGlob(relativePath: string, glob: string): boolean {
  return globToRegExp(glob).test(relativePath)
}

function matchesAny(relativePath: string, globs: string[]): boolean {
  return globs.some((glob) => matchesGlob(relativePath, glob))
}

async function walk(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue
    if (IGNORE_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, files)
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full)
    }
  }
  return files
}

function extractImportSources(content: string): string[] {
  const sources: string[] = []
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+)\s+from\s+['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:[\w*{}\s,$]+)\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const source = match[1]
      if (source) sources.push(source)
    }
  }
  return sources
}

function resolveAlias(importSource: string): string | null {
  if (!importSource.startsWith('@/')) return null
  return importSource.slice(2)
}

const PROCESS_ENV_ALLOWED = new Set([
  'lib/env.ts',
  'middleware.ts',
  'playwright.config.ts',
  'vitest.config.ts',
  'drizzle.config.ts',
])

const PROCESS_ENV_ALLOWED_PREFIXES = ['scripts/', 'tests/', 'eval/']

function checkFile(relativePath: string, content: string): Violation[] {
  const violations: Violation[] = []
  const imports = extractImportSources(content)

  for (const source of imports) {
    if (source === '@arcadeai/arcadejs' || source.startsWith('@arcadeai/arcadejs/')) {
      if (!matchesAny(relativePath, ['lib/arcade/**', 'scripts/**'])) {
        violations.push({
          file: relativePath,
          rule: 'arcadejs-package',
          detail: `@arcadeai/arcadejs may only be imported from lib/arcade/** or scripts/** (found ${source})`,
        })
      }
    }

    if (source === 'better-auth' || source.startsWith('better-auth/')) {
      if (!matchesAny(relativePath, ['lib/auth/**', 'app/api/auth/**'])) {
        violations.push({
          file: relativePath,
          rule: 'better-auth-package',
          detail: `better-auth may only be imported from lib/auth/** or app/api/auth/** (found ${source})`,
        })
      }
    }

    if (source.startsWith('@ai-sdk/')) {
      if (!matchesAny(relativePath, ['lib/ai/**'])) {
        violations.push({
          file: relativePath,
          rule: 'ai-sdk-package',
          detail: `@ai-sdk/* may only be imported from lib/ai/** (found ${source})`,
        })
      }
    }

    if (source === 'ai') {
      if (!matchesAny(relativePath, ['lib/ai/**', 'lib/aig/repair.ts'])) {
        violations.push({
          file: relativePath,
          rule: 'ai-package',
          detail: `ai may only be imported from lib/ai/** or lib/aig/repair.ts (found ${source})`,
        })
      }
    }

    if (source === 'drizzle-orm' || source.startsWith('drizzle-orm/')) {
      if (!matchesAny(relativePath, ['lib/db/**', 'scripts/**'])) {
        violations.push({
          file: relativePath,
          rule: 'drizzle-package',
          detail: `drizzle-orm may only be imported from lib/db/** or scripts/** (found ${source})`,
        })
      }
    }

    if (source === 'postgres') {
      if (!matchesAny(relativePath, ['lib/db/**', 'scripts/**'])) {
        violations.push({
          file: relativePath,
          rule: 'postgres-package',
          detail: `postgres may only be imported from lib/db/** or scripts/** (found ${source})`,
        })
      }
    }

    if (source === 'pino') {
      if (relativePath !== 'lib/logger.ts') {
        violations.push({
          file: relativePath,
          rule: 'pino-package',
          detail: 'pino may only be imported from lib/logger.ts',
        })
      }
    }

    const alias = resolveAlias(source)
    if (!alias) continue

    if (
      matchesAny(relativePath, ['components/**']) &&
      (matchesAny(alias, ['lib/db/**', 'lib/arcade/**']) ||
        alias === 'lib/auth/server.ts' ||
        alias.startsWith('lib/auth/server'))
    ) {
      violations.push({
        file: relativePath,
        rule: 'ui-layer',
        detail: `components/** must not import ${source}`,
      })
    }

    if (
      matchesAny(relativePath, ['app/**']) &&
      !matchesAny(relativePath, ['app/api/**']) &&
      (matchesAny(alias, ['lib/db/**', 'lib/arcade/**']) ||
        alias === 'lib/auth/server.ts' ||
        alias.startsWith('lib/auth/server'))
    ) {
      violations.push({
        file: relativePath,
        rule: 'app-layer',
        detail: `app pages/layouts must not import ${source} — use API routes or lib/auth/client`,
      })
    }

    if (matchesAny(relativePath, ['lib/aig/**'])) {
      const isOrchestrator =
        relativePath === 'lib/aig/executor.ts' || relativePath === 'lib/aig/expire.ts'
      const isRepair = relativePath === 'lib/aig/repair.ts'

      if (matchesAny(alias, ['lib/db/**', 'lib/arcade/**', 'lib/auth/**']) && !isOrchestrator) {
        violations.push({
          file: relativePath,
          rule: 'aig-pure',
          detail: `lib/aig/** must stay pure — cannot import ${source} (orchestrators: executor.ts, expire.ts only)`,
        })
      }

      if (matchesAny(alias, ['lib/ai/**']) && !isRepair) {
        violations.push({
          file: relativePath,
          rule: 'aig-pure',
          detail: 'only lib/aig/repair.ts may import lib/ai/**',
        })
      }

      if (source === 'ai' && !isRepair) {
        violations.push({
          file: relativePath,
          rule: 'aig-pure',
          detail: 'only lib/aig/repair.ts may import ai directly',
        })
      }
    }
  }

  if (
    /\bprocess\.env\b/.test(content) &&
    !PROCESS_ENV_ALLOWED.has(relativePath) &&
    !PROCESS_ENV_ALLOWED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
  ) {
    violations.push({
      file: relativePath,
      rule: 'process-env',
      detail: 'process.env may only be read in lib/env.ts (or allowed config/test paths)',
    })
  }

  return violations
}

async function main(): Promise<void> {
  const files = await walk(ROOT)
  const allViolations: Violation[] = []

  for (const file of files) {
    const relativePath = path.relative(ROOT, file).replaceAll('\\', '/')
    if (relativePath.startsWith('lib/db/migrations/')) continue
    if (relativePath === 'scripts/check-boundaries.ts') continue

    const content = await readFile(file, 'utf8')
    allViolations.push(...checkFile(relativePath, content))
  }

  if (allViolations.length === 0) {
    console.info('check-boundaries: ok')
    return
  }

  console.error(`check-boundaries: ${allViolations.length} violation(s)\n`)
  for (const v of allViolations) {
    console.error(`  [${v.rule}] ${v.file}\n    ${v.detail}\n`)
  }
  process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

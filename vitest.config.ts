import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Load .env.local so EVAL_MODE=live picks up real ANTHROPIC_API_KEY and
// ARCADE_API_KEY. Parsed inline rather than via @next/env because Vite's
// ESM config loader does not let the @next/env CJS import mutate
// process.env reliably across worker boundaries.
const envLocal = readEnvLocal()
const evalMode = process.env['EVAL_MODE'] ?? envLocal['EVAL_MODE'] ?? 'mock'
const isLive = evalMode === 'live'
const isArcadeIntegration = process.env['RUN_ARCADE_INTEGRATION'] === '1'

function readEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    const out: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

function liveEnv(name: string, fallback: string): string {
  return isLive || isArcadeIntegration
    ? (process.env[name] ?? envLocal[name] ?? fallback)
    : fallback
}

function optionalLiveEnv(name: string): string | undefined {
  return isLive || isArcadeIntegration ? (process.env[name] ?? envLocal[name]) : undefined
}

const testEnv: Record<string, string> = {
  SKIP_ENV_VALIDATION: '1',
  DATABASE_URL:
    process.env['DATABASE_URL'] ??
    envLocal['DATABASE_URL'] ??
    'postgres://test:test@localhost:5432/aig_test',
  ANTHROPIC_API_KEY: liveEnv('ANTHROPIC_API_KEY', 'test-key'),
  ARCADE_API_KEY: liveEnv('ARCADE_API_KEY', 'test-key'),
  DEMO_USER_ID: liveEnv('DEMO_USER_ID', 'demo@arcadeintent.graph'),
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
  EVAL_MODE: evalMode,
}

if (process.env['RUN_ARCADE_INTEGRATION']) {
  testEnv['RUN_ARCADE_INTEGRATION'] = process.env['RUN_ARCADE_INTEGRATION']
}

const arcadeMcpGatewayUrl = optionalLiveEnv('ARCADE_MCP_GATEWAY_URL')
if (arcadeMcpGatewayUrl) {
  testEnv['ARCADE_MCP_GATEWAY_URL'] = arcadeMcpGatewayUrl
}

const arcadeMcpAuthToken = optionalLiveEnv('ARCADE_MCP_AUTH_TOKEN')
if (arcadeMcpAuthToken) {
  testEnv['ARCADE_MCP_AUTH_TOKEN'] = arcadeMcpAuthToken
}

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    env: testEnv,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'eval/**/*.eval.ts'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['lib/aig/**/*.ts', 'lib/db/queries.ts'],
      exclude: ['**/*.d.ts', '**/types.ts', '**/prompts/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})

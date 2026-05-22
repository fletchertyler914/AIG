import { createRequire } from 'node:module'
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env') as typeof import('@next/env')
loadEnvConfig(process.cwd())

/**
 * Typed, validated environment access.
 *
 * Importing from anywhere else (`process.env.X` etc.) is forbidden — the
 * Biome `noProcessEnv` lint rule plus the Cursor architecture rule guard this.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    ARCADE_API_KEY: z.string().min(1),
    ARCADE_BASE_URL: z.string().url().optional(),
    DEMO_USER_ID: z.string().email().default('demo@arcadeintent.graph'),
    DEMO_USE_SLACK: z
      .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
      .default('false'),
    E2E_MOCK_ARCADE: z
      .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
      .optional(),
  },
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env['NODE_ENV'],
    LOG_LEVEL: process.env['LOG_LEVEL'],
    DATABASE_URL: process.env['DATABASE_URL'],
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
    ARCADE_API_KEY: process.env['ARCADE_API_KEY'],
    ARCADE_BASE_URL: process.env['ARCADE_BASE_URL'],
    DEMO_USER_ID: process.env['DEMO_USER_ID'],
    DEMO_USE_SLACK: process.env['DEMO_USE_SLACK'],
    E2E_MOCK_ARCADE: process.env['E2E_MOCK_ARCADE'],
  },
  skipValidation:
    process.env['SKIP_ENV_VALIDATION'] === '1' || process.env['npm_lifecycle_event'] === 'lint',
  emptyStringAsUndefined: true,
})

export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'
export const isDevelopment = env.NODE_ENV === 'development'
export const isArcadeMocked = env.E2E_MOCK_ARCADE === '1' || env.E2E_MOCK_ARCADE === 'true'
export const isDemoSlackEnabled = env.DEMO_USE_SLACK === '1' || env.DEMO_USE_SLACK === 'true'

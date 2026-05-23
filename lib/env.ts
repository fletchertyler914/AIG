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
    ARCADE_MCP_GATEWAY_URL: z.string().url().optional(),
    ARCADE_MCP_AUTH_TOKEN: z.string().min(1).optional(),
    // ── Auth (Better Auth) ───────────────────────────────────────────────
    /** 32-byte random secret used to sign session cookies and tokens. */
    BETTER_AUTH_SECRET: z.string().min(32),
    /** Public origin of the app, used by Better Auth for callback URLs. */
    BETTER_AUTH_URL: z.string().url(),
    /** Vercel deployment environment; provided automatically on Vercel. */
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
    /** Vercel deployment hostname; provided automatically without protocol. */
    VERCEL_URL: z.string().min(1).optional(),
    /** Resend API key for magic-link delivery. Optional in dev (logs to console). */
    RESEND_API_KEY: z.string().min(1).optional(),
    /** From address for magic-link + notification emails. */
    EMAIL_FROM: z.string().default('AIG <noreply@aig.local>'),
    // ── Demo seeds (legacy, used until org/workspace seeding lands) ──────
    DEMO_USER_ID: z.string().email().default('demo@arcadeintent.graph'),
    DEMO_USE_SLACK: z
      .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
      .default('false'),
    E2E_MOCK_ARCADE: z
      .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
      .optional(),
    /** Bypass auth middleware for deterministic Playwright runs. */
    E2E_SKIP_AUTH: z
      .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
      .optional(),
    /** Capture magic-link URLs for Playwright sign-in tests. */
    E2E_CAPTURE_MAGIC_LINK: z
      .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
      .optional(),
    /**
     * Arcade user verification mode:
     * - `arcade` — Arcade.dev user verifier (local dev default). Personal OAuth
     *   uses operator email as Arcade user_id; Arcade default OAuth apps work.
     * - `custom` — AIG custom verifier + prefixed user IDs (production default).
     */
    ARCADE_VERIFIER_MODE: z.enum(['arcade', 'custom']).optional(),
  },
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env['NODE_ENV'],
    LOG_LEVEL: process.env['LOG_LEVEL'],
    DATABASE_URL: process.env['DATABASE_URL'],
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
    ARCADE_API_KEY: process.env['ARCADE_API_KEY'],
    ARCADE_BASE_URL: process.env['ARCADE_BASE_URL'],
    ARCADE_MCP_GATEWAY_URL: process.env['ARCADE_MCP_GATEWAY_URL'],
    ARCADE_MCP_AUTH_TOKEN: process.env['ARCADE_MCP_AUTH_TOKEN'],
    BETTER_AUTH_SECRET: process.env['BETTER_AUTH_SECRET'],
    BETTER_AUTH_URL: process.env['BETTER_AUTH_URL'],
    VERCEL_ENV: process.env['VERCEL_ENV'],
    VERCEL_URL: process.env['VERCEL_URL'],
    RESEND_API_KEY: process.env['RESEND_API_KEY'],
    EMAIL_FROM: process.env['EMAIL_FROM'],
    DEMO_USER_ID: process.env['DEMO_USER_ID'],
    DEMO_USE_SLACK: process.env['DEMO_USE_SLACK'],
    E2E_MOCK_ARCADE: process.env['E2E_MOCK_ARCADE'],
    E2E_SKIP_AUTH: process.env['E2E_SKIP_AUTH'],
    E2E_CAPTURE_MAGIC_LINK: process.env['E2E_CAPTURE_MAGIC_LINK'],
    ARCADE_VERIFIER_MODE: process.env['ARCADE_VERIFIER_MODE'],
  },
  skipValidation:
    process.env['SKIP_ENV_VALIDATION'] === '1' || process.env['npm_lifecycle_event'] === 'lint',
  emptyStringAsUndefined: true,
})

export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'
export const isDevelopment = env.NODE_ENV === 'development'
export const isArcadeMocked = env.E2E_MOCK_ARCADE === '1' || env.E2E_MOCK_ARCADE === 'true'
export const isE2eAuthSkipped = env.E2E_SKIP_AUTH === '1' || env.E2E_SKIP_AUTH === 'true'
export const isE2eCaptureMagicLink =
  env.E2E_CAPTURE_MAGIC_LINK === '1' || env.E2E_CAPTURE_MAGIC_LINK === 'true'

export type ArcadeVerifierMode = 'arcade' | 'custom'

/** Resolved verifier mode — defaults to arcade in dev, custom in production/test. */
export function getArcadeVerifierMode(): ArcadeVerifierMode {
  if (env.ARCADE_VERIFIER_MODE) return env.ARCADE_VERIFIER_MODE
  if (isProduction || isTest) return 'custom'
  return 'arcade'
}

export function usesArcadeUserVerifier(): boolean {
  return getArcadeVerifierMode() === 'arcade'
}
export const isDemoSlackEnabled = env.DEMO_USE_SLACK === '1' || env.DEMO_USE_SLACK === 'true'

/**
 * Public origin for auth callbacks and OAuth return URLs.
 *
 * Production uses the canonical custom domain from BETTER_AUTH_URL. Preview
 * deployments use Vercel's per-deployment URL so cookies and callbacks match
 * the preview hostname being tested.
 */
export function getPublicAppOrigin(): string {
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) {
    const host = env.VERCEL_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
    return `https://${host}`
  }

  return env.BETTER_AUTH_URL.replace(/\/$/, '')
}

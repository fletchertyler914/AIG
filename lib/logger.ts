import { pino } from 'pino'
import { env, isDevelopment } from '@/lib/env'

/**
 * Pino logger configured for OTel-compatible structured output.
 *
 * In development, pretty-prints to stderr. In production, emits NDJSON
 * which Vercel's log drains forward to OTel collectors automatically.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'aig',
    env: env.NODE_ENV,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.apiKey',
      '*.ARCADE_API_KEY',
      '*.ANTHROPIC_API_KEY',
      '*.DATABASE_URL',
    ],
    censor: '[REDACTED]',
  },
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname,service,env',
        singleLine: false,
      },
    },
  }),
})

export type Logger = typeof logger

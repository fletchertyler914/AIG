import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/lib/db/schema'
import { env, isProduction } from '@/lib/env'

/**
 * Singleton Postgres client + Drizzle instance.
 *
 * In dev (HMR), Next.js can re-evaluate this module — stash on globalThis to
 * avoid leaking connection pools.
 */
declare global {
  // eslint-disable-next-line no-var
  var __aigPgClient: postgres.Sql | undefined
}

const sql =
  globalThis.__aigPgClient ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: isProduction ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 30,
  })

if (!isProduction) globalThis.__aigPgClient = sql

export const db = drizzle(sql, { schema, logger: false })

export type Db = typeof db
export { schema }

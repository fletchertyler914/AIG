/**
 * Baseline Drizzle migration history for databases created via `db:push`.
 *
 * When the schema already exists but `drizzle.__drizzle_migrations` is empty,
 * `pnpm db:migrate` fails replaying 0000 (duplicate tables/types). This script
 * records migrations whose effects are already present so only new migrations run.
 *
 *   pnpm db:baseline
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import postgres from 'postgres'

const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env') as typeof import('@next/env')
loadEnvConfig(process.cwd())

const MIGRATIONS_DIR = join(process.cwd(), 'lib/db/migrations')

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

interface Journal {
  entries: JournalEntry[]
}

function migrationHash(filename: string): string {
  const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
  return createHash('sha256').update(sql).digest('hex')
}

async function isMigrationApplied(sql: postgres.Sql, tag: string): Promise<boolean> {
  switch (tag) {
    case '0000_elite_hemingway': {
      const [row] = await sql`
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'intents'
          LIMIT 1
        `
      return Boolean(row)
    }
    case '0001_connection_scope': {
      const [row] = await sql`
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'toolkit_connections'
            AND column_name = 'scope'
          LIMIT 1
        `
      return Boolean(row)
    }
    default:
      return false
  }
}

async function main() {
  const url = process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL is required')

  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8'),
  ) as Journal

  const sql = postgres(url)

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `

  const existing = await sql<{ hash: string }[]>`
    SELECT hash FROM drizzle.__drizzle_migrations
  `
  const appliedHashes = new Set(existing.map((row) => row.hash))

  let inserted = 0
  for (const entry of journal.entries) {
    const filename = `${entry.tag}.sql`
    const hash = migrationHash(filename)

    if (appliedHashes.has(hash)) {
      console.log(`skip ${entry.tag} (already recorded)`)
      continue
    }

    const effectsPresent = await isMigrationApplied(sql, entry.tag)
    if (!effectsPresent) {
      console.log(`skip ${entry.tag} (schema not present — run db:migrate instead)`)
      continue
    }

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `
    console.log(`baselined ${entry.tag}`)
    inserted += 1
  }

  await sql.end()

  if (inserted === 0) {
    console.log('nothing to baseline')
  } else {
    console.log(`baselined ${inserted} migration(s). Run pnpm db:migrate for any newer migrations.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

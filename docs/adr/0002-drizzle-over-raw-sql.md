# ADR-0002: Drizzle ORM over raw SQL

- Status: Accepted
- Date: 2026-05-22

## Context

The original draft used raw `@vercel/postgres` SQL with hand-typed wrapper
functions. The alternative is Drizzle ORM (TypeScript-first, edge-native,
SQL-like query API).

## Decision

**Drizzle.** End-to-end type safety from schema → query → API response is
non-negotiable for an "elite" codebase signal. Drizzle's TypeScript-first
schema model means the database is derived from code, migrations are
generated, and queries cannot drift from the schema without a typecheck
failure.

## Consequences

- `lib/db/schema.ts` is the source of truth for the database.
- Migrations live in `lib/db/migrations/` and are generated via
  `drizzle-kit generate` and applied via `drizzle-kit migrate`.
- `lib/db/queries.ts` exports typed query functions. No raw SQL strings
  outside `lib/db/`.
- The `postgres` driver is required (it's what Drizzle uses on Vercel).
- Edge runtime is supported out of the box.

## Alternatives considered

- Raw `@vercel/postgres` SQL: cheaper to read but every query becomes a
  manual typing exercise. Will rot.
- Prisma: ~200ms cold-start overhead on Vercel due to the Rust query engine.
  Larger bundle. Not as ergonomic for serverless.
- Kysely: pure query builder. Would require kysely-codegen and brings its
  own migration story. More moving parts than Drizzle.

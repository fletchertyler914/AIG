# AGENTS.md — Agent Operating Manual

This file is the single source of truth for any AI coding agent (Cursor, Claude
Code, Codex, etc.) contributing to this repository. Read this **before** making
changes. Cursor rules in `.cursor/rules/` enforce a subset of these as inline
guardrails.

If a guideline here conflicts with general training, **this file wins**.

---

## 1. Project shape

AIG is a **pre-execution governance runtime** for Arcade-powered AI agents.
It is not a workflow builder, not an observability tool, not an agent
framework. It is the layer that sits between an agent's *plan* and Arcade's
*execution*, allowing humans to inspect, repair, and approve transactional
intents before they touch real systems.

The core primitive is the **Intent** — a transactional grouping of MCP tool
calls with a locked objective, a dependency DAG, and an immutable
co-authorship trace of every mutation it has undergone.

---

## 2. Stack invariants

These versions are **load-bearing**. Bumping a major or minor without an ADR
in `docs/adr/` is forbidden.

| Layer        | Package                       | Pin       |
| ------------ | ----------------------------- | --------- |
| Runtime      | Node                          | 22 LTS    |
| Package mgr  | pnpm                          | ^11       |
| Framework    | next                          | 16.2.6    |
| UI runtime   | react, react-dom              | 19.2.6    |
| TypeScript   | typescript                    | ^5.9      |
| Styling      | tailwindcss                   | ^4.3      |
| AI runtime   | ai (Vercel AI SDK)            | ^6        |
| AI provider  | @ai-sdk/anthropic             | ^3        |
| Arcade SDK   | @arcadeai/arcadejs            | ^2.4      |
| ORM          | drizzle-orm + drizzle-kit     | ^0.45 / ^0.31 |
| DB driver    | postgres                      | ^3.4      |
| Validation   | zod                           | ^4        |
| Lint+format  | @biomejs/biome                | ^2.4      |
| Tests        | vitest                        | ^4        |
| E2E          | @playwright/test              | ^1.60     |
| Git hooks    | lefthook                      | ^2.1      |
| Logging      | pino                          | ^10       |

---

## 3. Module boundaries (HARD)

```
app/                    HTTP + UI layer. Only place that constructs Response objects.
  └── api/              Route handlers. Validate input with zod, return typed JSON.
  └── (dashboard)/      RSC pages. 'use client' only where strictly required.
components/             UI primitives + composed components. No data fetching.
  └── ui/               shadcn primitives — never edited manually except theming.
lib/aig/                PURE DOMAIN. No fetch, no fs, no env, no DB, no Arcade.
  ├── state.ts          Intent lifecycle state machine.
  ├── formation.ts      Window + DAG construction.
  ├── repair.ts         Constrained regeneration. Takes/returns plain data.
  ├── executor.ts       Execution ordering. Takes/returns plain data.
  └── prompts/          System prompts as .md files.
lib/db/                 ONLY place that imports `drizzle-orm`.
  ├── schema.ts
  ├── client.ts
  ├── queries.ts
  └── migrations/
lib/arcade/             ONLY place that imports `@arcadeai/arcadejs`.
  └── client.ts
lib/ai/                 ONLY place that imports `ai` or `@ai-sdk/*`.
  ├── anthropic.ts
  └── plan-agent.ts
lib/env.ts              ONLY place that reads process.env.
lib/logger.ts           ONLY place that imports `pino`.
eval/                   Repair eval harness. Imports lib/aig/* and mocks the rest.
tests/                  unit/ uses vitest. e2e/ uses playwright.
scripts/                One-off ops scripts. Run with `tsx`.
```

**Forbidden cross-imports** (enforced by `.cursor/rules/00-architecture.mdc`):

- `lib/aig/*` may not import `lib/db/*`, `lib/arcade/*`, `lib/ai/*`, or any
  package that performs I/O. It is *pure*.
- `app/*` and `components/*` may not import `lib/db/*` or `lib/arcade/*`
  directly. Go through an API route or a server action.
- Nothing outside `lib/env.ts` reads `process.env`.

---

## 4. State machine invariants

- Never bypass `assertTransition()` when updating intent status.
- Approved or done `ToolCall`s are **immutable**. Their `args` may not be
  modified. Repair must include them verbatim in `preserve`.
- The intent `objective` is set at FORMED time and **never changes**. Repair
  receives it as a locked input, never as something the model may rewrite.
- Mutations are append-only. Never UPDATE or DELETE a `mutations` row.

---

## 5. Repair contract

`lib/aig/repair.ts` exports `repairIntent(input)` which:

- Receives `{ objective (locked), lockedNodes, invalidatedNodes, preservedNodes, dependencyGraph }`.
- Calls Claude via AI SDK 6 `generateObject` with a zod-validated response schema.
- Returns `{ replace, preserve, remove }` — all IDs and new ToolCalls only.
- **Each call is a fresh LLM session.** No conversation history threading.
- The system prompt explicitly states `objective_locked: true`.

The eval harness in `eval/repair.eval.ts` is the gate before Phase 3. 9/9
cases must pass deterministically across 3 consecutive `EVAL_MODE=live` runs.

---

## 6. Quality gates (before every commit)

Pre-commit (automated by lefthook):
- `biome check --write` on staged files
- `tsc --noEmit` (incremental)

Pre-push (automated by lefthook):
- `vitest run tests/unit`
- `EVAL_MODE=mock vitest run eval`

CI (required to merge):
- `pnpm typecheck`
- `pnpm check:ci`
- `pnpm test:unit`
- `EVAL_MODE=mock pnpm test:eval`
- `pnpm test:e2e` (with `E2E_MOCK_ARCADE=1`)
- `pnpm build`

---

## 7. Commit conventions

Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`,
`ci:`, `build:`, `perf:`, `style:`, `revert:`), enforced by commitlint.

Examples:
- `feat(aig): add UNCERTAIN state for low-confidence groupings`
- `fix(repair): preserve human-edited args byte-for-byte`
- `test(repair): add case-09 human mutation preservation fixture`
- `docs(adr): add ADR-0005 co-authorship trace as hero`

---

## 8. What is intentionally NOT in this codebase

- Risk scoring (deterministic ImpactSummary replaces it)
- Predictive execution preview (out of MVP scope)
- Semantic causality metadata on DAG edges
- Cross-window intent merging
- Multi-agent / multi-session concurrency handling
- RBAC / role policies
- Compensating-transaction rollback (designed in ADR-0004, not built in MVP)

Do not add these without an ADR + design discussion.

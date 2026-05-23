# AGENTS.md — Agent Operating Manual

This file is the single source of truth for any AI coding agent (Cursor, Claude
Code, Codex, etc.) contributing to this repository. Read this **before** making
changes. Cursor rules in `.cursor/rules/` enforce a subset as inline guardrails
(see `CONTRIBUTING.md` for the rule map).

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
| Auth         | better-auth                   | ^1.6      |
| Email        | resend + react-email          | ^6        |

---

## 3. Module boundaries (HARD)

```
app/                    HTTP + UI layer. Only place that constructs Response objects.
  └── api/              Route handlers. Validate input with zod, return typed JSON.
  └── app/              Authenticated control plane (RSC + client islands).
components/             UI primitives + composed components. No data fetching.
  └── ui/               shadcn-style primitives — Button, Card, Dialog, etc.
                        Use Dialog (Radix) for ALL modals/confirmations.
                        Never use window.confirm/alert/prompt.
lib/aig/                PURE DOMAIN. No fetch, no fs, no env, no DB, no Arcade.
  ├── state.ts          Intent lifecycle state machine.
  ├── formation.ts      Window + DAG construction.
  ├── repair.ts         Constrained regeneration. Takes/returns plain data.
  ├── executor.ts       Execution ordering (orchestrates via injected wrappers).
  ├── connection-auth.ts  Pure connection-scope validation for execution.
  ├── approval-policy.ts  Pure policy matching for approve-time gates.
  ├── expire.ts         TTL / expiry rules.
  └── prompts/          System prompts as .md files.
lib/arcade/             ONLY place that imports `@arcadeai/arcadejs`.
  ├── client.ts         Singleton SDK client.
  ├── identity.ts       Stable Arcade user_id chokepoint (ADR-0010).
  ├── verifier.ts       auth.confirmUser wrapper.
  ├── authorize.ts      tools.authorize + pending flow binding.
  ├── catalog.ts        Curated + full toolkit index (SDK pagination + cache).
  ├── tools.ts            execute + formatted list wrappers.
  └── mock.ts             E2E mock (type-compatible with real client).
lib/display/            Presentation helpers with no I/O (safe for components).
  ├── toolkits.ts       Human-readable toolkit + tool labels.
  └── args-form.ts      Flat arg → labeled form field inference.
lib/intent/             Intent lifecycle orchestration (DB + Arcade I/O).
  └── authorization-sync.ts  Re-check OAuth; SSE fingerprint for live UI.
lib/auth/               ONLY place that imports `better-auth`.
  ├── server.ts         Better Auth config + Drizzle adapter.
  ├── client.ts         Browser auth client.
  ├── session.ts        resolveWorkspaceContext() for API routes.
  └── provision.ts      Org + workspace bootstrap on sign-in.
lib/db/                 ONLY place that imports `drizzle-orm`.
  ├── schema.ts         Domain tables (intents, connections, workspaces, …).
  ├── auth-schema.ts    Better Auth tables (generated — run pnpm auth:generate).
  ├── client.ts
  ├── queries.ts        Intent graph queries.
  ├── connection-queries.ts  Toolkit connections + resolveConnectionForTool().
  ├── approval-policy-queries.ts  Workspace approval policies + rules.
  ├── workspace-queries.ts
  └── migrations/
lib/ai/                 ONLY place that imports `ai` or `@ai-sdk/*`.
  ├── anthropic.ts
  ├── plan-agent.ts
  └── labeler.ts
lib/api/                Shared HTTP helpers (jsonOk, parseJson, …).
lib/env.ts              ONLY place that reads process.env. Also resolves
                        ARCADE_VERIFIER_MODE (arcade everywhere by default for
                        single-project setups; custom only when each env has
                        its own Arcade project).
lib/logger.ts           ONLY place that imports `pino`.
proxy.ts                Next 16 proxy (was `middleware.ts`). Session-cookie
                        gate for /app/**. Edge runtime — reads process.env
                        directly for E2E_SKIP_AUTH.
eval/                   Repair eval harness. Imports lib/aig/* and mocks the rest.
tests/                  unit/ (vitest), integration/, e2e/ (playwright).
scripts/                One-off ops scripts. Run with `tsx`.
docs/adr/               Architecture decision records — read before big changes.
```

**Forbidden cross-imports** (enforced by `.cursor/rules/00-architecture.mdc`):

- `lib/aig/*` may not import `lib/db/*`, `lib/arcade/*`, `lib/ai/*`, or any
  package that performs I/O. It is *pure*.
- `app/*` and `components/*` may not import `lib/db/*` or `lib/arcade/*`
  directly. Go through an API route or a server action.
- Nothing outside `lib/env.ts` reads `process.env`.

---

## 3a. Arcade integration preference

Always prefer **Arcade SDK → REST API → MCP** over hand-rolled alternatives:

| Do | Don't |
| ---- | ----- |
| `client.tools.list()` via `lib/arcade/client.ts` | Raw `fetch` to `api.arcade.dev/v1/...` |
| `client.tools.formatted.list()` for model schemas | Hand-wrap tool JSON schemas |
| `client.auth.confirmUser()` / `tools.authorize()` | Custom OAuth or auth HTTP |
| Official MCP tools when building MCP surfaces | Reimplement the same calls ad hoc |
| Paginate SDK list APIs when no toolkit endpoint exists | Scrape docs.arcade.dev or maintain a forked catalog |

Application caching, deduplication, and UI-side filtering in `lib/arcade/` are
acceptable. Reimplementing Arcade's wire protocol is not.

---

## 3b. Auth & tenancy

AIG is a multi-tenant control plane (ADR-0009):

- **Sign-in** — Better Auth magic link (`lib/auth/`). Resend in production.
- **Tenancy** — Better Auth organizations + AIG `workspaces` (`production` |
  `sandbox`).
- **API context** — Every authenticated route calls `resolveWorkspaceContext()`.
- **Arcade identity** — Separate from AIG sign-in; see ADR-0010 and
  `lib/arcade/identity.ts`.

Cursor rule: `.cursor/rules/40-auth-tenancy.mdc`.

---

## 3c. Connections & toolkit scope

Toolkit OAuth is stored in `toolkit_connections` with scope `personal` or
`shared` (ADR-0010). The Arcade Dashboard "custom verifier" setting is
project-global, so **a single Arcade project = a single verifier mode**.

| Mode | Personal `user_id` | Shared `user_id` | When to use |
| ---- | ------------------ | ---------------- | ----------- |
| `arcade` (recommended default) | operator email | not supported | One Arcade project across envs; Arcade default OAuth apps |
| `custom` (opt-in) | `user:{betterAuthUserId}` | `workspace:{workspaceId}` | Dedicated prod Arcade project + BYO OAuth + custom verifier URL |

Set with `ARCADE_VERIFIER_MODE` per environment. Custom mode requires the
verifier route + BYO OAuth credentials in the Arcade Dashboard **and** a
dedicated Arcade project for that environment.

At execution, `resolveConnectionForTool()` picks personal → shared → blocked.
Pure validation lives in `lib/aig/connection-auth.ts`.

Connections UI/API: `app/api/connections/`, `components/connections/`.
Catalog: curated default + full-index search via SDK `tools.list` pagination
(`lib/arcade/catalog.ts`).

OAuth UX invariants:
- **New tab.** Clicking Connect / Authorize opens OAuth in `window.open(_, '_blank')`,
  not a same-tab redirect. The current page refreshes on `visibilitychange` or
  `focus` so stale `pending` rows resolve without manual reload.
- **Sync on read.** `GET /api/connections` re-checks Arcade (`tools.authorize`)
  for any non-`completed`/`failed` row and flips them to `completed` when Arcade
  reports the grant covers their scopes.
- **Scoped removal.** OAuth tokens are per-provider, not per-toolkit. Removing one
  toolkit revokes the provider grant (`admin.userConnections.delete`) then
  immediately re-authorizes the remaining same-provider toolkits so the user only
  loses scopes for the removed toolkit.

---

## 3d. Approval policies

Workspace approval policies are coarse Sprint 4 gates:

- Stored in `approval_policies` + `approval_policy_rules`.
- Managed by workspace owner/admin from Settings.
- Evaluated in `POST /api/intents/[id]/approve` before `markIntentApproved()`.
- Pure matching lives in `lib/aig/approval-policy.ts`; DB reads live in
  `lib/db/approval-policy-queries.ts`.

Rules match Arcade tool names with `*` wildcards (for example
`Gmail.SendEmail*`, `Slack.*`, `*`) and take one of two actions:

| Action | Behavior |
| ------ | -------- |
| `require_admin_approval` | Intent can be approved only by org owner/admin |
| `block` | Intent cannot be approved while the rule is enabled |

Team settings are backed by Better Auth `member` + `invitation` tables. The UI
is read-only for members and lets owner/admin users create or remove pending
invites.

---

## 4. State machine invariants

- Never bypass `assertTransition()` when updating intent status.
- Approved or done `ToolCall`s are **immutable**. Their `args` may not be
  modified. Repair must include them verbatim in `preserve`.
- Human-added actions write a `human_added` mutation, become preserved nodes
  during downstream repair, and should not bypass the co-authorship trace.
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
- `pnpm check:boundaries` (module import rules)
- `vitest run tests/unit`
- `EVAL_MODE=mock vitest run eval`

CI (required to merge):
- `pnpm typecheck`
- `pnpm check:ci`
- `pnpm check:boundaries`
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
- Fine-grained RBAC / per-tool policies (org owner/admin gates **shared**
  connections only — see ADR-0010; not full enterprise RBAC)
- Compensating-transaction rollback (designed in ADR-0004, not built in MVP)

Do not add these without an ADR + design discussion.

---

## 9. Engineering standards

These qualities are explicit project goals. Cursor enforces a subset via
`.cursor/rules/45-engineering-standards.mdc`.

### Modularity

- **Pure core** — Business rules in `lib/aig/*` with zero I/O. If it needs DB,
  Arcade, or env, it belongs in `lib/db/*`, `lib/arcade/*`, or the route layer.
- **Chokepoints** — One module per cross-cutting concern (identity, state
  transitions, workspace context). Extend the chokepoint; don't fork logic.
- **Thin HTTP layer** — Routes validate, authorize, delegate, serialize. No
  business logic in route files beyond orchestration.

### Performance & scalability

- Bound external calls (pagination, curated subsets, explicit limits).
- Cache expensive SDK scans with TTL + inflight deduplication
  (`lib/arcade/catalog.ts` is the reference pattern).
- Avoid N+1 queries; batch reads in list endpoints.
- Prefer RSC + streaming; `'use client'` only for interactivity.
- Long-running work: `maxDuration`, background refresh, or explicit user action —
  never block first paint on a full Arcade catalog scan.

### Maintainability

- **ADRs** for architectural decisions (`docs/adr/README.md`).
- **Append-only audit** — never mutate historical mutations or co-authorship rows.
- **Conventional commits** with scoped messages (see §7).
- Comments explain *why* and link to ADRs/discussions — not *what* the code does.

### UI conventions

- **Modals + confirmations** use `components/ui/dialog.tsx` (Radix). Never
  `window.confirm` / `window.alert` / `window.prompt`.
- **Destructive actions** use the `destructive` button variant inside a Dialog,
  with the active label switching to a `…` progress state while pending.
- **Toasts** (`sonner`) for non-blocking success/error feedback. They are not
  a substitute for confirmation dialogs.

### Quality gates

Same as §6 — no merging without green CI. **`pnpm check:boundaries`** enforces
import rules from §3 (Arcade SDK chokepoint, UI layer isolation, pure `lib/aig/*`).
Repair eval live gate (9/9 × 3 runs) before shipping repair prompt changes.

### Security

- Secrets and env parsing only in `lib/env.ts`.
- Structured logging with redaction in `lib/logger.ts`.
- Zod validation on every mutating API boundary.
- Arcade OAuth isolated from AIG sign-in; custom verifier requires a dedicated
 prod Arcade project (ADR-0010 — single-project default uses `arcade` mode).

---

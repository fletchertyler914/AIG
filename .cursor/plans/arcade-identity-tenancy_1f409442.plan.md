---
name: aig-control-plane-roadmap
overview: >-
  Control-plane delivery roadmap for AIG. Phases 1, 2, 4, and 6 are shipped on the
  current branch (1 ahead of origin/main + uncommitted polish). Pending phases:
  production cutover, approval policies, remaining product gaps.
todos:
  # ── Phase 1: Arcade identity + connections (DONE) ────────────────────────
  - id: adr
    content: ADR-0009/0010 + cursor rules 00/30/40/45 + AGENTS.md
    status: completed
  - id: verifier
    content: Custom verifier via auth.confirmUser — lib/arcade/verifier.ts, app/api/arcade/verify/route.ts
    status: completed
  - id: identity
    content: lib/arcade/identity.ts chokepoint — branches on ARCADE_VERIFIER_MODE (arcade=email / custom=user:{id}+workspace:{id})
    status: completed
  - id: migration
    content: Drizzle migration 0001_connection_scope — scope, owner_user_id, arcade_user_id, partial uniques
    status: completed
  - id: resolver-executor
    content: resolveConnectionForTool + executor invariant + intents.approved_by_user_id
    status: completed
  - id: ui-api
    content: Connections API + UI (personal / workspace columns, role-gated shared connect)
    status: completed
  - id: auth-providers
    content: Provider catalog + admin readiness panel (Settings) + Connections badges via admin.authProviders.list
    status: completed
  - id: tests-p1
    content: Unit tests — verifier, identity, connection-resolve, authorize, boundaries
    status: completed
  # ── Phase 2: Intent UI + auth UX (DONE) ──────────────────────────────────
  - id: intent-ui
    content: Modern-retro tokens, intent canvas (dagre DAG), side panel, trace drawer, args form
    status: completed
  - id: auth-sync
    content: lib/intent/authorization-sync.ts + SSE fingerprint + intent Authorize via POST /api/connections
    status: completed
  - id: app-shell
    content: /app layout, sidebar, header, landing, sign-in, proxy.ts session gate (Next 16)
    status: completed
  # ── Phase 3 — Polish + dev/prod verifier (DONE) ──────────────────────────
  - id: verifier-mode
    content: ARCADE_VERIFIER_MODE env (arcade in dev, custom in prod) — lib/env.ts + identity.ts + authorize.ts
    status: completed
  - id: dialog-primitive
    content: components/ui/dialog.tsx Radix Dialog; removed all window.confirm usage
    status: completed
  - id: oauth-newtab
    content: Connect/Authorize buttons open OAuth in new tab; visibilitychange/focus auto-refresh
    status: completed
  - id: connections-sync
    content: syncPendingConnections re-checks Arcade on GET /api/connections to flip pending→completed
    status: completed
  - id: scoped-removal
    content: DELETE /api/connections/[toolkit] revokes provider grant then re-authorizes remaining same-provider toolkits
    status: completed
  - id: e2e-auth
    content: Playwright magic-link capture + /api/test/magic-link + fixtures/auth.ts
    status: completed
  # ── Phase 4: Pipelines (DONE) ────────────────────────────────────────────
  - id: pipeline-model
    content: Pipeline schema migration 0002, lib/aig/pipeline.ts, lib/db/pipeline-queries.ts
    status: completed
  - id: pipeline-ui
    content: Pipelines API, registry UI, Save as pipeline + Run pipeline on intent detail
    status: completed
  # ── Phase 5: Insights + UNCERTAIN split (DONE) ───────────────────────────
  - id: insights
    content: /app/insights workspace stats API + dashboard
    status: completed
  - id: uncertain-split
    content: Split UNCERTAIN UI — AUTH REQUIRED vs LOW CONFIDENCE badges
    status: completed
  # ── Phase 6: Production cutover (PENDING) ────────────────────────────────
  - id: dashboard-oauth
    content: 'MANUAL — Arcade Dashboard: switch to custom verifier + Google OAuth credentials for prod tenant'
    status: pending
  - id: prod-cutover
    content: 'Set ARCADE_VERIFIER_MODE=custom in Vercel; push branch; live E2E against prod tenant'
    status: pending
  # ── Phase 7: Approval policies (PENDING) ─────────────────────────────────
  - id: policies
    content: Per-tool-pattern approval rules, reviewer roles beyond owner/admin, team invites in Settings
    status: pending
  # ── Phase 8: Remaining product gaps (PENDING) ────────────────────────────
  - id: add-action
    content: Add-action / replan API + UI from intent detail
    status: pending
  - id: pipeline-first-create
    content: Pipeline-first creation entry on dashboard (template chooser, not only freeform prompt)
    status: pending
isProject: true
---

# AIG control plane roadmap

**Branch state:** 1 commit ahead of `origin/main` (`479ab91` last roadmap refresh),
plus a substantial uncommitted polish round documented under Phase 3 below.

---

## Phase 1 — Arcade identity + scoped connections ✅

### End state

```mermaid
flowchart LR
    BA["Better Auth session"] --> Verify["/api/arcade/verify"]
    Verify --> Confirm["auth.confirmUser(flow_id, user_id)"]
    Confirm --> Arcade["Arcade OAuth complete"]
    Id["lib/arcade/identity.ts<br/>(branches on ARCADE_VERIFIER_MODE)"]
    Id -->|"arcade mode → operator email"| AuthZ["tools.authorize"]
    Id -->|"custom personal → user:{userId}"| AuthZ
    Id -->|"custom shared → workspace:{workspaceId}"| AuthZ
    AuthZ --> TC["toolkit_connections.pending_flow_id"]
    TC --> Verify
```

### Key files

| Area | Path |
| ---- | ---- |
| ADRs | [docs/adr/0009](docs/adr/0009-control-plane-architecture.md), [docs/adr/0010](docs/adr/0010-arcade-custom-verifier-and-connection-scope.md) (amended) |
| Identity | [lib/arcade/identity.ts](lib/arcade/identity.ts), [lib/env.ts](lib/env.ts) (`getArcadeVerifierMode`) |
| Verifier | [lib/arcade/verifier.ts](lib/arcade/verifier.ts), [app/api/arcade/verify/route.ts](app/api/arcade/verify/route.ts) |
| Connections | [app/api/connections/route.ts](app/api/connections/route.ts), [lib/db/connection-queries.ts](lib/db/connection-queries.ts) |
| Provider readiness | [lib/arcade/auth-providers.ts](lib/arcade/auth-providers.ts), [components/settings/auth-providers-panel.tsx](components/settings/auth-providers-panel.tsx) |
| Executor | [lib/aig/executor.ts](lib/aig/executor.ts), [lib/aig/connection-auth.ts](lib/aig/connection-auth.ts) |

---

## Phase 2 — Intent UI + live auth sync ✅

| Deliverable | Path |
| ----------- | ---- |
| Modern-retro design tokens | [app/globals.css](app/globals.css) |
| DAG canvas + list fallback | [components/intent/intent-canvas.tsx](components/intent/intent-canvas.tsx) |
| Side panel (Overview / Details, args editor) | [components/intent/intent-side-panel.tsx](components/intent/intent-side-panel.tsx) |
| Co-authorship trace drawer | [components/intent/intent-trace-drawer.tsx](components/intent/intent-trace-drawer.tsx) |
| Typed args form + JSON fallback | [lib/display/args-form.ts](lib/display/args-form.ts) |
| Live OAuth sync (no manual refresh) | [lib/intent/authorization-sync.ts](lib/intent/authorization-sync.ts) |
| Intent Authorize → connections POST | [intent-side-panel.tsx](components/intent/intent-side-panel.tsx) (stores `pending_flow_id`) |
| App shell + session-gate proxy | [app/app/layout.tsx](app/app/layout.tsx), [proxy.ts](proxy.ts) |

---

## Phase 3 — Polish + dev/prod verifier ✅ (uncommitted)

The big set of follow-up changes after the WIP commit, currently uncommitted:

| Change | Path |
| ------ | ---- |
| Dev/prod verifier mode env | [lib/env.ts](lib/env.ts) `getArcadeVerifierMode()` / `usesArcadeUserVerifier()` |
| Identity branches on mode | [lib/arcade/identity.ts](lib/arcade/identity.ts) |
| `authorize` omits `next_uri` in `arcade` mode | [lib/arcade/authorize.ts](lib/arcade/authorize.ts) |
| Arcade provider revoke (`admin.userConnections`) | [lib/arcade/authorize.ts](lib/arcade/authorize.ts) `revokeUserConnection` |
| Scoped removal — revoke + reauthorize remaining | [app/api/connections/[toolkit]/route.ts](app/api/connections/[toolkit]/route.ts) DELETE |
| List-time connection sync | [app/api/connections/route.ts](app/api/connections/route.ts) `syncPendingConnections` |
| New-tab OAuth + visibility refresh | [components/connections/connections-client.tsx](components/connections/connections-client.tsx), [components/intent/intent-side-panel.tsx](components/intent/intent-side-panel.tsx) |
| Radix Dialog primitive (no native confirms) | [components/ui/dialog.tsx](components/ui/dialog.tsx) |
| Remove-toolkit confirmation dialog | [components/connections/connections-client.tsx](components/connections/connections-client.tsx) `RemoveToolkitDialog` |
| Next 16 proxy migration | [proxy.ts](proxy.ts) (was `middleware.ts`) |
| Auth-provider DTO exposes verifier mode | [app/api/auth-providers/route.ts](app/api/auth-providers/route.ts), [components/settings/auth-providers-panel.tsx](components/settings/auth-providers-panel.tsx) |
| Playwright magic-link auth fixtures | [tests/e2e/fixtures/auth.ts](tests/e2e/fixtures/auth.ts), [app/api/test/magic-link/route.ts](app/api/test/magic-link/route.ts) |
| Pipelines (Sprint 3) | [lib/aig/pipeline.ts](lib/aig/pipeline.ts), [lib/db/pipeline-queries.ts](lib/db/pipeline-queries.ts), [app/api/pipelines/](app/api/pipelines), [components/pipelines/](components/pipelines) |
| Insights (Sprint 5) | [lib/db/insights-queries.ts](lib/db/insights-queries.ts), [app/api/insights/](app/api/insights), [components/insights/](components/insights) |
| UNCERTAIN badge split | [lib/display/intent-status.ts](lib/display/intent-status.ts), [components/intent/intent-dashboard.tsx](components/intent/intent-dashboard.tsx) |

Docs/rules refresh (this pass):

| File | What changed |
| ---- | ------------ |
| [AGENTS.md](AGENTS.md) | `proxy.ts`, Dialog primitive, verifier-mode identity table, OAuth UX invariants, UI conventions |
| [.cursor/rules/00-architecture.mdc](.cursor/rules/00-architecture.mdc) | Pipelines/insights/connections sync placement, UI conventions block |
| [.cursor/rules/30-arcade.mdc](.cursor/rules/30-arcade.mdc) | OAuth UX, scoped revocation, admin.* preference |
| [.cursor/rules/45-engineering-standards.mdc](.cursor/rules/45-engineering-standards.mdc) | UI conventions (no native dialogs) |
| [docs/adr/0010](docs/adr/0010-arcade-custom-verifier-and-connection-scope.md) | Amendments — dev/prod mode, scoped removal, list-time sync, proxy |
| [README.md](README.md) | Surface table updated to Shipped; verifier mode in setup |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev vs prod verifier mode setup |

---

## Phase 6 — Production cutover 🔲

**Goal:** Flip the deployed tenant to `custom` verifier mode and run an end-to-end
authorized intent in production.

| Task | Owner | Notes |
| ---- | ----- | ----- |
| Custom verifier URL in Arcade Dashboard | Manual | `${BETTER_AUTH_URL}/api/arcade/verify` |
| Google OAuth app in Arcade Dashboard | Manual | One app covers all Google toolkits |
| `ARCADE_VERIFIER_MODE=custom` in Vercel | Manual | Identity flips to `user:{id}` / `workspace:{id}` |
| Push branch + verify intent Authorize round-trip | Code | Already wired |
| Playwright magic-link auth (replace `E2E_SKIP_AUTH=1` incrementally) | Code | Fixtures already in place |

**Quality gate before push:**

```bash
pnpm typecheck && pnpm check:boundaries && pnpm test:unit && EVAL_MODE=mock pnpm test:eval
```

---

## Phase 7 — Approval policies (Sprint 4) 🔲

- [ ] Policy rules per tool pattern (glob / toolkit / action)
- [ ] Reviewer roles beyond org owner/admin
- [ ] Team invites + member management in Settings
- [ ] Replace Settings approvals/team empty states

Data model is ready: `intents.approved_by_user_id`, workspace membership via
Better Auth org. New tables expected: `approval_policies`, `policy_rules`.
Will require an ADR amendment to ADR-0009.

---

## Phase 8 — Remaining product gaps 🔲

- [ ] **Add action / replan** — API + UI to insert a new tool call into an
      existing intent and trigger constrained repair. Repair engine already
      supports this shape; needs a route and a side-panel affordance.
- [ ] **Pipeline-first creation** — `/app/new` flow that lists pipelines and
      lets a user kick off a run from a template, not only freeform plan.
- [ ] **Seeded demo pipeline** — onboarding artifact for new tenants.

---

## Explicitly out of scope (ADR-0009 §8)

Do not build without a new ADR:

- Risk scoring, predictive execution preview, cross-window merging
- Full enterprise RBAC, compensating-transaction rollback
- API-key toolkit auth (Arcade Secrets later if needed)
- Cross-email account linking in Better Auth

---

## Quality gates (every phase)

Pre-commit: biome + tsc. Pre-push: boundaries + unit + mock eval. CI: + e2e + build.

Repair prompt changes still require live eval gate: 9/9 × 3 consecutive `EVAL_MODE=live` runs.

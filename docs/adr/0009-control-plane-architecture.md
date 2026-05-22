# ADR 0009: Control Plane Architecture

## Status

Accepted — May 2026

## Context

AIG began as a single-tenant intent graph demo. The product thesis evolved: **AIG is the
control plane for Arcade pipelines** — the governance, orchestration, and audit layer companies
need to deploy agents on Arcade's 7,000+ tools in production.

## Decision

### Layered architecture

1. **Identity** — Better Auth (magic link via Resend). AIG owns sign-in; Arcade owns tool OAuth.
   Arcade `user_id` values are stable prefixed IDs (`user:{id}` or `workspace:{id}`), not emails.
   A custom verifier route confirms identity via `auth.confirmUser`. See ADR-0010.

2. **Tenancy** — Better Auth `organization` plugin for company tenants. AIG `workspaces` table
   for execution boundaries (`production` | `sandbox`) inside each org.

3. **Execution plane** — Existing intent graph (plan agent → formation → repair → approve →
   Arcade execute). Unchanged semantics; now scoped by `workspace_id`.

4. **Control plane surfaces** (sequenced delivery):
   - Sprint 1: Auth + workspaces + app shell + marketing
   - Sprint 2: Connections (Arcade OAuth per workspace)
   - Sprint 3: Pipelines (versioned templates)
   - Sprint 4: Approval policies + audit log
   - Sprint 5: Insights + seeded demo pipeline

### Auth vendor choice

We chose **Better Auth** over Auth.js v5 and WorkOS because:

- `organization()` plugin ships multi-tenancy without custom tables
- `magicLink()` plugin + Resend = zero password surface
- Native Drizzle adapter matches our stack
- No second identity vendor — Arcade stays the tool-auth story

WorkOS/SSO deferred until enterprise customers require it.

### Toolkit routing deferred

Explicit workspace connections + user-selected toolkits replace regex inference.
An `LlmToolkitSelector` seam is documented but not shipped — routing is not the moat.

## Consequences

- All intents require `workspace_id` (NOT NULL after backfill migration)
- API routes resolve workspace via `resolveWorkspaceContext()`
- E2E uses `E2E_SKIP_AUTH=1` until Playwright signs in via magic link
- Production requires `RESEND_API_KEY` + verified `EMAIL_FROM` domain

## References

- Better Auth organization plugin: https://www.better-auth.com/docs/plugins/organization
- Arcade tool authorization: `lib/arcade/authorize.ts`

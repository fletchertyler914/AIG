# ADR 0009: Control Plane Architecture

## Status

Accepted — May 2026. Amended May 2026 (Sprint 4 approval-policy foundation).

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

### Sprint 4 approval-policy foundation

Approval policies are workspace-scoped gates evaluated before an intent is
approved. The first shipped slice is deliberately coarse:

- `approval_policies` owns name, workspace, enabled state, and author.
- `approval_policy_rules` owns wildcard tool patterns and actions.
- Matching is pure (`lib/aig/approval-policy.ts`) and uses Arcade tool names
  such as `Gmail.SendEmail*`, `Slack.*`, or `*`.
- `POST /api/intents/[id]/approve` evaluates policies before
  `markIntentApproved()` and writes matched rules into the approval mutation.

Supported actions:

| Action | Behavior |
| ------ | -------- |
| `require_admin_approval` | Matching intents require an org owner/admin approver |
| `block` | Matching intents cannot be approved while the rule is enabled |

Reviewer roles beyond Better Auth owner/admin, assignment workflows, and team
invites beyond pending-record management remain in the next Sprint 4 slice.

### Human-added actions and replan

Intent repair now supports adding a new action to an existing graph. The route
appends a `human_added` mutation, inserts a pending tool call, and when the new
action is anchored after an existing node it invalidates that node's direct
dependents so repair can regenerate downstream calls with the added action in
context. The objective remains locked.

### Seed pipeline

New workspaces receive a starter pipeline if they do not have any pipelines.
The template is addressed to the operator's email and gives the pipeline-first
dashboard a usable starting point without manual setup.

## Consequences

- All intents require `workspace_id` (NOT NULL after backfill migration)
- API routes resolve workspace via `resolveWorkspaceContext()`
- E2E uses `E2E_SKIP_AUTH=1` until Playwright signs in via magic link
- Production requires `RESEND_API_KEY` + verified `EMAIL_FROM` domain
- Approval policies are checked at approval time, not plan time; they do not
  mutate tool calls or repair output.
- Human-added actions extend the co-authorship trace; repair may adapt
  downstream nodes but should preserve the inserted action.

## References

- Better Auth organization plugin: https://www.better-auth.com/docs/plugins/organization
- Arcade tool authorization: `lib/arcade/authorize.ts`
- Approval policy evaluator: `lib/aig/approval-policy.ts`
- Seed pipeline template: `lib/aig/pipeline.ts`

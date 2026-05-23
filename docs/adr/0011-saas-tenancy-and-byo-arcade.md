# ADR 0011: SaaS Tenancy and BYO Arcade (North Star)

## Status

**Proposed — May 2026.** Not in flight. This ADR captures the target architecture
for evolving AIG into a multi-tenant SaaS where production customers own their
Arcade project, their OAuth credentials, and (optionally) their encryption keys.
It is the north star against which incremental phases should be evaluated, not a
commitment to ship any specific phase by a deadline.

## Context

AIG today is a single-tenant control plane. One Arcade project, one shared API
key in `lib/env.ts`, one set of OAuth credentials in the operator's Arcade
Dashboard. Better Auth organizations + AIG workspaces already give us a logical
tenancy boundary, but every workspace shares the same Arcade backend.

That model works for a hosted demo. It does **not** work for paying customers:

- A SaaS provider holding the production Arcade key for every tenant is a
  single point of compromise.
- OAuth scope decisions (which Google scopes a tenant grants their agents)
  belong to the tenant, not to AIG.
- Audit, isolation, and billing all need a clean per-tenant seam so they can
  evolve independently.
- Enterprise prospects require defense-in-depth (RLS, BYO KMS, dedicated DB
  option) before they sign a DPA.

This ADR documents the long-term shape so we stop accidentally making decisions
that paint us into a corner.

## Decision

### 1. Workspace is the tenancy primitive everywhere

- `workspace_id` is the single isolation key for: intents, mutations, tool
  calls, pipelines, policies, connections, audit, secrets, usage records,
  webhook subscriptions, and API keys.
- `Organization` is the **billing + identity** boundary (one Stripe customer,
  one SSO config). Orgs contain many workspaces (`production`, `staging`,
  `sandbox`, …).
- `Member` joins a user to an org with workspace-scoped roles.
- No cross-workspace resource ever exists. Anything that needs "shared across
  workspaces" is duplicated, not joined.

### 2. BYO Arcade for production, managed sandbox for trial

| Plane | Arcade project | OAuth provider apps | Verifier mode |
| ----- | -------------- | ------------------- | ------------- |
| Sandbox workspace (Free) | AIG-managed | AIG's | `arcade` (operator email) |
| Production workspace (Pro+) | Customer-owned | Customer's | `custom` (`user:{id}` / `workspace:{id}`) |

A workspace stores its own Arcade project credentials. AIG's runtime calls the
customer's Arcade project via the supplied API key, not via a shared global
client. The current global `lib/arcade/client.ts` singleton is replaced by a
per-workspace resolver:

```ts
// lib/arcade/client.ts (target shape)
export async function arcadeClientFor(workspaceId: string): Promise<Arcade>
```

Sandbox workspaces resolve to the AIG-managed client. Production workspaces
resolve to a client constructed from the workspace's stored Arcade credentials.

### 3. Secrets: envelope encryption with per-workspace data keys

- Customer Arcade API keys, OAuth client secrets, webhook signing secrets, and
  any other tenant-owned secret live in a `workspace_secrets` table with **only
  ciphertext + key reference**, never plaintext.
- Each workspace has a Data Encryption Key (DEK), wrapped at rest by a Key
  Encryption Key (KEK) held in AWS KMS / GCP KMS / HashiCorp Vault.
- Enterprise tier: customers can supply their own KMS key (BYOK) — wrapping
  with their CMK gives them a kill switch (revoking the CMK invalidates AIG's
  access without a support ticket).
- Every secret read goes through `lib/secrets/` and writes an `audit_log`
  entry: `actor + workspace + secret_id + ts + request_id`.
- Type-system enforced redaction: `Sensitive<string>` newtype whose
  `toString()` returns `***`. Pino redaction is a backstop, not the primary
  defense.

### 4. Defense-in-depth isolation

- **App-level:** `resolveWorkspaceContext()` already injects `workspaceId` into
  every authenticated request. This stays.
- **DB-level:** Postgres Row-Level Security policies on every tenant-scoped
  table, keyed on `current_setting('app.workspace_id')`. Drizzle issues a
  `SET LOCAL app.workspace_id = ...` at the start of each request transaction.
  If a controller forgets a `WHERE workspace_id = ?` clause, Postgres still
  blocks the leak.
- **Edge-level:** Optional subdomain isolation (`acme.arcadeintentgraph.xyz`)
  gives cookies, CSRF tokens, and rate-limit buckets a natural tenant scope.
  Until then, all cookies are workspace-agnostic at the org level.
- **Background jobs / queues:** workspace id is the partition key, not a
  column the worker remembers to check.

### 5. Identity + access scales to enterprise without a rewrite

- Better Auth remains the self-serve path (magic link, email/password later).
- Architected to swap to **SAML / OIDC SSO + SCIM** for Pro+ tiers without
  changing application code — Better Auth's plugin model supports this, and
  WorkOS is the documented escape hatch if we outgrow it.
- **JIT provisioning:** first SSO sign-in creates a Member with an IdP-mapped
  role.
- **RBAC:** roles per workspace (`owner`, `admin`, `developer`, `reviewer`,
  `viewer`) and per-resource permissions for intents, policies, pipelines,
  secrets, and audit. Approval policies (ADR-0009) compose on top — a
  `reviewer` role is the natural target for `require_admin_approval`.
- **Service accounts** with scoped API keys: each key has a name, owner,
  scopes, origin allowlist, and `last_used_at`. Rotation is a new row.
- **MFA + session management** in Settings: list active sessions, revoke
  remotely, idle timeout.

### 6. Billing wired into entitlements, not bolted on

- **Stripe Billing** is the source of truth for plans. AIG mirrors entitlements
  in `workspace_plan` for fast checks.
- **Entitlement middleware** at the API boundary:
  `requireEntitlement('byo_arcade')`, `requireEntitlement('audit_export')`.
- **Metered usage** via Stripe usage records: intents created, mutations
  applied, policy evaluations, Arcade tool calls executed.
- **Plan gates** are zod-validated at HTTP boundaries (route handlers), not
  sprinkled through domain code. `lib/aig/*` stays pure.
- **Hard limits + soft warnings:** 80% triggers in-app banner, 100% blocks
  with a clear upgrade CTA. Failed payment → `workspace_status = past_due`
  (read-only with grace period) → hard-suspend.

#### Reference tier shape

| Tier | Arcade | Workspaces | Members | Intents/mo | Audit retention | SSO | SLA |
| ---- | ------ | ---------- | ------- | ---------- | --------------- | --- | --- |
| Free | Sandbox | 1 | 3 | 100 | 7 days | No | None |
| Pro | BYO | 3 | 25 | 10k | 90 days | No | 99.9% |
| Enterprise | BYO + dedicated option | Unlimited | Unlimited | Custom | Unlimited | SAML/SCIM | 99.95% + DPA |

Exact numbers belong in `docs/saas-validation.md`, not in this ADR.

### 7. Platform parity: API, SDKs, webhooks, CLI

- Every resource visible in the UI must be available via a public REST API
  with the same shape.
- **OpenAPI spec is the contract** — generated from zod schemas, published,
  versioned, never silently broken.
- **First-party SDKs** (TypeScript first, Python second) wrapping the REST
  API.
- **Outbound webhooks** with HMAC signing, at-least-once delivery, dead-letter
  inspection: `intent.created`, `intent.approved`, `intent.failed`,
  `policy.matched`, `mutation.added`.
- **CLI** (`aig`) wrapping the API for CI/ops.
- **Terraform provider** (Enterprise) for policies, pipelines, workspace
  settings as code.

### 8. Audit + observability as customer-visible products

- **Audit log** is a first-class API resource, not a debugging tool: filterable,
  exportable to S3 / SIEM, signed. Append-only (already true for `mutations`;
  extend to all admin actions: sign-in, secret access, policy edits, approval
  decisions, role changes).
- **Per-workspace observability dashboard:** throughput, error rates, latency,
  top tools, top failures, MTTR for blocked intents.
- **Trace IDs** propagated through every request and surfaced in error
  responses so support can correlate without log spelunking.
- **Per-tenant rate limits and quotas** are visible to the customer in the UI,
  not enforced silently.
- **Public status page** (statuspage.io) with incident subscription.
- **`security.txt` + disclosure policy + bug bounty program** before the first
  paid customer signs.

## Sequencing (sketch — not a commitment)

The order is what gives the most leverage with the least architectural debt.
Phase boundaries are intentionally fuzzy; ADR amendments fill in details when
each phase actually starts.

1. **Foundation:** BYO Arcade per workspace + envelope-encrypted
   `workspace_secrets` + Postgres RLS on tenant-scoped tables. After this,
   shared infra is safe to host real customers.
2. **Commerce:** Stripe Billing + entitlement middleware + usage metering. Free
   sandbox vs Pro BYO becomes a real product distinction.
3. **Platform:** Public REST API + OpenAPI spec + TypeScript SDK + webhooks.
   Converts AIG from product to platform.
4. **Enterprise readiness:** SSO/SCIM + audit log export + DPA + SOC 2 Type II
   prep. Only triggered by a real enterprise prospect.
5. **Operational polish:** CLI, Terraform provider, BYO KMS, dedicated DB
   option, multi-region. Each pulled forward when a contract demands it.

## What this ADR explicitly *does not* decide

- Specific pricing numbers (free-tier intent cap, Pro price). Validation work,
  not architecture.
- Whether to host on Vercel forever vs migrate to Fly / Render / Kubernetes.
- Whether to white-label or stay AIG-branded.
- Specific compliance certifications beyond "SOC 2 prep falls out for free if
  we do 1–4 correctly."

## Consequences

- The global `lib/arcade/client.ts` singleton must be refactored before BYO
  Arcade lands. Every Arcade call site already routes through `lib/arcade/*` —
  threading `workspaceId` into `arcadeClientFor(workspaceId)` is mechanical
  but touches every call site.
- `lib/env.ts` stops being the source of truth for `ARCADE_API_KEY` in
  production paths. It still carries the sandbox/default key for the
  managed-tier workspace.
- Sandbox workspaces are an explicit product surface, not a debug mode. They
  need quota enforcement and clear "upgrade to BYO" CTAs from day one of
  Phase 2.
- RLS introduces a per-request `SET LOCAL` overhead. Acceptable; the safety
  win dwarfs the cost.
- Audit-log surface area grows: every mutation, secret access, policy edit,
  role change, and admin action is recorded. Storage is cheap; retention is a
  plan dial.
- Approval policies (ADR-0009) and connections (ADR-0010) compose with this
  ADR but do not need to change. `reviewer` role is the obvious next addition
  to ADR-0009's policy model.

## References

- ADR-0009 (control plane architecture — sets up the workspace primitive)
- ADR-0010 (Arcade verifier + connection scope — sets up the identity story
  per workspace)
- [Postgres Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Stripe Billing usage records](https://docs.stripe.com/billing/subscriptions/usage-based)
- [Better Auth organization plugin](https://www.better-auth.com/docs/plugins/organization)
- `docs/saas-validation.md` — pre-build validation plan (demo, design partners,
  pricing experiments).

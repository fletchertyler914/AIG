# ADR 0010: Arcade Custom Verifier and Connection Scope

## Status

Accepted — May 2026. Amended May 2026 (dev/prod verifier mode + scoped removal).

## Context

AIG operators sign in via Better Auth (magic link). Arcade tool OAuth is a separate
flow. With Arcade's default **Arcade.dev users only** verifier, the browser must be
signed into arcade.dev with the same email AIG passes as `user_id`. That breaks
multi-user production use (teammates don't have arcade.dev accounts) and fails when
an operator's AIG email differs from their arcade.dev session.

Additionally, some toolkits are inherently **personal** (Gmail, Google Calendar) while
others are **org-wide** (Slack workspace bot, GitHub org install). The original schema
allowed only one connection row per `(workspace, toolkit)`.

## Decision

### 1. Custom user verifier

AIG implements a server-side verifier route at `/api/arcade/verify`. When Arcade
redirects the browser after OAuth, the route:

1. Reads `flow_id` from the query string.
2. Looks up the pending flow binding (stored when `tools.authorize` started).
3. Calls `client.auth.confirmUser({ flow_id, user_id })` with the Arcade API key.
4. Redirects the operator back to `/app/connections`.

Configure in Arcade Dashboard → Auth → Settings → **Custom verifier**:
`${BETTER_AUTH_URL}/api/arcade/verify`

**Note:** Arcade's default OAuth apps only work with the Arcade user verifier. Production
multi-user apps must register their own OAuth credentials per provider.

### 2. Stable Arcade identity (not email)

Never pass `session.user.email` as Arcade `user_id`. Use prefixed stable IDs:

| Scope    | Arcade `user_id` format      |
| -------- | ---------------------------- |
| personal | `user:{betterAuthUserId}`    |
| shared   | `workspace:{workspaceId}`    |

Implemented in `lib/arcade/identity.ts` — the single chokepoint.

### 3. Connection scope on `toolkit_connections`

Add `scope` enum (`personal` | `shared`), `owner_user_id` (FK → user, NULL for shared),
and rename `connected_user_id` → `arcade_user_id`.

Partial unique indexes:

- `UNIQUE(workspace_id, toolkit_name, owner_user_id) WHERE scope = 'personal'`
- `UNIQUE(workspace_id, toolkit_name) WHERE scope = 'shared'`

Resolution order at execution: personal row for approver → shared row → null (blocked).

### 4. Executor invariant (replaces email equality)

Old rule: `approved_by === arcade user_id` (string equality on email).

New rule: for each tool call, `resolveConnectionForTool` must return a row that is
(a) `auth_status = completed`, and (b) either:

- `scope = personal` with `owner_user_id = intent.approved_by_user_id`, or
- `scope = shared` in the intent's workspace where `approved_by_user_id` is an org member.

Violations throw `AIGBlockedAuthError`.

`intents.approved_by_user_id` (FK → user) is written alongside legacy `approved_by`
(display email) for backward-compatible audit rendering.

## Amendments (May 2026)

### Dev/prod verifier mode

The original decision implied custom verifier everywhere. In practice the
local-dev experience is much smoother with Arcade's built-in user verifier
(no BYO OAuth apps, no public verifier URL). We added `ARCADE_VERIFIER_MODE`
to `lib/env.ts` with two values:

| Mode | Personal `user_id` | Shared | Use |
| ---- | ------------------ | ------ | --- |
| `custom` (prod default) | `user:{betterAuthUserId}` | `workspace:{workspaceId}` | Multi-user production with BYO OAuth |
| `arcade` (dev default) | operator email | not supported | Single operator local dev with Arcade default OAuth apps |

`lib/arcade/identity.ts` branches on the resolved mode; the chokepoint rule
still holds. `authorizeToolkit` also omits `next_uri` in `arcade` mode —
Arcade's user verifier rejects arbitrary return URIs.

The "never email as `user_id`" rule remains in force for `custom` (production)
mode. Falling back to email under `arcade` mode is deliberate so dev users see
the same OAuth experience they'd see on arcade.dev's playground.

### Scoped toolkit removal

OAuth providers issue scopes at the **provider** level (one Google grant
covers Gmail + Calendar + Drive). Arcade's `user_connections` API confirms
this — there is one row per `(user_id, provider)`, with the union of all
scopes ever consented. There is no API to subtract a single scope.

Removing one toolkit therefore performs a three-step dance:

1. `revokeUserConnection()` calls `admin.userConnections.list` + `.delete`,
   dropping the provider grant entirely.
2. `resetConnectionAfterRevoke()` clears auth state for the toolkit being
   removed (so it stays in the `disconnected` state).
3. For every *other* toolkit in the same provider family, re-call
   `tools.authorize`. If Arcade returns an `auth_url`, surface it as
   `reauthorizeUrl` so the UI can immediately re-open OAuth and let the user
   re-consent to only the scopes they still want.

Provider family is normalized via a helper that strips Arcade's `arcade-*`
provider prefix. Reference: `app/api/connections/[toolkit]/route.ts` DELETE.

### List-time connection sync

The original design assumed an SSE/return-handler would mark connections
`completed`. In practice the parent tab is often hidden during OAuth and
misses the signal. `GET /api/connections` now calls `syncPendingConnections`,
which re-checks Arcade (`tools.authorize` on the toolkit's representative
tool) for any row not already `completed`/`failed` and flips it as soon as
the grant is live. The Connect/Authorize UI relies on `visibilitychange` +
`focus` to trigger this fetch on tab return.

### Next.js 16 proxy

`middleware.ts` is deprecated in Next 16. Session-cookie gating for `/app/**`
moved to `proxy.ts` (exporting `proxy`, not `middleware`). The boundary
checker allows `proxy.ts` to read `process.env` directly because it runs in
the edge runtime before module init.

## Consequences

- Operators never need an arcade.dev account in production.
- Local dev works with zero Arcade Dashboard configuration.
- Two humans in the same workspace can each connect personal Gmail.
- One admin can connect Slack once for the whole workspace.
- Removing one Google toolkit no longer cascades to all Google toolkits —
  the user re-consents to the remaining set in a single OAuth flow.
- Catalog cache is keyed by Arcade `user_id`, not a module-global singleton.
- Pending OAuth flows are tracked via `pending_flow_id` on connection rows.

## References

- [Secure Auth in Production](https://docs.arcade.dev/en/guides/user-facing-agents/secure-auth-production)
- [Arcade auth providers](https://docs.arcade.dev/en/references/auth-providers)
- ADR-0009 (control plane architecture — identity section amended)
- `lib/arcade/identity.ts`, `lib/arcade/authorize.ts`, `app/api/arcade/verify/route.ts`
- `app/api/connections/route.ts` (`syncPendingConnections`)
- `app/api/connections/[toolkit]/route.ts` (DELETE — scoped removal)

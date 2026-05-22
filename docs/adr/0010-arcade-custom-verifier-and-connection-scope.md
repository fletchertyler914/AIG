# ADR 0010: Arcade Custom Verifier and Connection Scope

## Status

Accepted — May 2026

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

## Consequences

- Operators never need an arcade.dev account.
- Two humans in the same workspace can each connect personal Gmail.
- One admin can connect Slack once for the whole workspace.
- Catalog cache is keyed by Arcade `user_id`, not a module-global singleton.
- Pending OAuth flows are tracked via `pending_flow_id` on connection rows.

## References

- [Secure Auth in Production](https://docs.arcade.dev/en/guides/user-facing-agents/secure-auth-production)
- ADR-0009 (control plane architecture — identity section amended)
- `lib/arcade/identity.ts`, `app/api/arcade/verify/route.ts`

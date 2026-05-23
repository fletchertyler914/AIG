# Contributing to AIG

Thanks for opening this repo. Before you touch code:

1. Read `AGENTS.md` end-to-end — module boundaries, auth, connections, and
   engineering standards are enforced by Cursor rules, Biome, and CI.
2. Read `docs/adr/README.md`. Any change that contradicts an ADR requires a
   new ADR superseding it.

## Local setup

```bash
nvm use                 # Node 22
corepack enable         # activates pnpm@11.2.2
pnpm install
cp .env.example .env.local
# Required: DATABASE_URL, ANTHROPIC_API_KEY, ARCADE_API_KEY, BETTER_AUTH_SECRET, BETTER_AUTH_URL
# Optional dev: RESEND_API_KEY (magic links log to console if unset)
pnpm db:push            # fresh local DB
# OR for existing DBs that used db:push before migrations:
#   pnpm db:baseline && pnpm db:migrate
pnpm dev
```

### Arcade OAuth

Arcade Dashboard → Auth → User Verifier is a **project-global** setting. A single
Arcade project cannot point at both localhost and production. Pick one of two
setups; the code supports both via `ARCADE_VERIFIER_MODE` in `lib/env.ts`.

**Recommended — single-project (default):**

- Arcade Dashboard stays on **Arcade user verifier** (no custom URL).
- Set `ARCADE_VERIFIER_MODE=arcade` in **every** environment (`.env.local` and
  prod env). Sign into arcade.dev with the same email as AIG and Arcade's
  default OAuth apps just work.
- Each operator's email is their Arcade `user_id`. Shared (workspace-scope)
  connections are disabled in this mode.

**Multi-project — production with BYO OAuth (opt-in):**

Use this only when you maintain **two separate Arcade projects** (dev and prod),
because the Dashboard verifier URL must be unique per project.

1. Create the prod Arcade project. Arcade Dashboard → Auth → Settings →
   **Custom verifier**: `${BETTER_AUTH_URL}/api/arcade/verify`.
2. Register your own OAuth apps per **provider family** (Connected Apps → Add
   OAuth Provider). One Google app covers Gmail, Calendar, Drive, etc.
3. Set `ARCADE_VERIFIER_MODE=custom` only in the prod environment and use the
   prod project's API key there. Keep dev on the single-project setup above
   with its own API key.

See ADR-0010 (amended) for the full identity contract and the scoped-removal
flow used when revoking a single toolkit from a multi-toolkit provider grant.

## Quality gates

```bash
pnpm typecheck          # strict TS — must pass
pnpm check:ci           # Biome lint + format — must pass
pnpm check:boundaries   # module import boundaries — must pass
pnpm test:unit          # vitest — must pass
pnpm test:eval          # mock-mode eval harness — must pass
pnpm test:e2e           # Playwright (E2E_MOCK_ARCADE=1) — must pass in CI
pnpm build              # Next.js production build — must pass
```

All run in CI on every push. Lefthook runs typecheck + biome on commit, boundaries +
unit + mock eval on push.

Optional local integration:

```bash
pnpm test:arcade:live   # real Arcade SDK (opt-in env flags)
pnpm test:eval:live     # repair vs real Claude
```

## Commit style

Conventional Commits, enforced by commitlint:

- `feat(aig): add UNCERTAIN state for low-confidence groupings`
- `fix(repair): preserve human-edited args byte-for-byte`
- `feat(connections): add workspace-scoped OAuth rows`
- `docs(adr): add ADR-0010 custom verifier and connection scope`

Allowed scopes: `aig`, `db`, `arcade`, `ai`, `ui`, `api`, `auth`, `connections`,
`eval`, `adr`, `config`, `deps`, `ci`.

## When to write an ADR

Whenever you make a decision that:

- Changes a stack invariant (versions in `AGENTS.md` §2).
- Breaks or extends a module boundary (`AGENTS.md` §3).
- Reverses an existing ADR in `docs/adr/`.
- Adds an item from the "intentionally not built" list in `AGENTS.md` §8.
- Introduces a new cross-cutting pattern (caching, auth, tenancy) others must follow.

ADRs live in `docs/adr/NNNN-kebab-title.md`. Update `docs/adr/README.md`.

## Cursor rules map

| Rule | Scope |
| ---- | ----- |
| `00-architecture.mdc` | Module boundaries (always on) |
| `45-engineering-standards.mdc` | Quality, performance, testing (always on) |
| `scripts/check-boundaries.ts` | Machine-enforced import boundaries (CI) |
| `10-state-machine.mdc` | `lib/aig/state.ts` |
| `20-repair.mdc` | Repair engine + eval |
| `30-arcade.mdc` | Arcade SDK, connections, executor |
| `40-auth-tenancy.mdc` | Better Auth + workspaces |

## License of contributions

This project is source-available under [`FSL-1.1-MIT`](LICENSE.md). By
submitting a pull request you agree that your contribution is licensed under
the same terms — including the two-year MIT future grant. If you cannot agree
to this (for example because your employer asserts ownership of your work),
please do not submit the contribution.

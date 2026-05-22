# Contributing to AIG

Thanks for opening this repo. Before you touch code:

1. Read `AGENTS.md` end-to-end. The module boundaries and stack invariants
   listed there are enforced by Cursor rules, Biome, and CI.
2. Read the ADRs in `docs/adr/`. Any change that contradicts an ADR requires
   a new ADR superseding it.

## Local setup

```bash
nvm use                 # Node 22
corepack enable         # activates pnpm@11.2.2
pnpm install
cp .env.example .env.local
# fill in DATABASE_URL, ANTHROPIC_API_KEY, ARCADE_API_KEY
pnpm db:push            # apply schema to local Postgres
pnpm dev
```

## Quality gates

```bash
pnpm typecheck          # strict TS — must pass
pnpm check:ci           # Biome lint + format — must pass
pnpm test:unit          # vitest — must pass
pnpm test:eval          # mock-mode eval harness — must pass
pnpm build              # Next.js production build — must pass
```

All five run in CI on every push. Lefthook runs the first three on every
commit, and the unit + mock eval tests on every push.

## Commit style

Conventional Commits, enforced by commitlint:

- `feat(aig): add UNCERTAIN state for low-confidence groupings`
- `fix(repair): preserve human-edited args byte-for-byte`
- `test(repair): add case-09 human mutation preservation fixture`
- `docs(adr): add ADR-0005 co-authorship trace as hero`

Allowed scopes: `aig`, `db`, `arcade`, `ai`, `ui`, `api`, `eval`, `adr`,
`config`, `deps`, `ci`.

## When to write an ADR

Whenever you make a decision that:

- Changes a stack invariant (versions in `AGENTS.md` §2).
- Breaks a module boundary (`AGENTS.md` §3).
- Reverses an existing ADR.
- Adds an item from the "intentionally not built" list in `AGENTS.md` §8.

ADRs live in `docs/adr/NNNN-kebab-title.md` and use the structure of the
existing ones.

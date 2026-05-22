# AIG — Arcade Intent Graph

> A pre-execution governance runtime for Arcade-powered AI agents.
> Agents propose. Humans constrain. The runtime repairs. Arcade executes.
> The negotiation is the artifact.

[ Live demo ] · [ 90-second video ] · [ Architecture ]

---

## What this is

Most agent infrastructure shows you either:

- what the agent did (LangSmith, AgentOps — observability)
- what you configured the agent to do (n8n, Zapier — workflow)
- how the agent calls tools (LangGraph, OpenAI Agents — frameworks)

AIG shows you **how authority evolves between human and agent before
anything actually happens** — the negotiated execution layer that sits
above Arcade's MCP runtime and below your LLM.

### The loop

```
09:41  Agent proposed "Coordinate customer follow-up"
       ├─ Gmail.SendEmail × 2
       ├─ Calendar.CreateEvent × 2
       └─ Gmail.SendEmail × 1 (internal summary)
09:42  Human removed Calendar.CreateEvent (Globex)
09:42  System invalidated dependent summary
09:43  Agent regenerated downstream actions
       └─ Summary email rewritten (no longer mentions Globex meeting)
09:44  Human edited Gmail.SendEmail.body (Acme thread)
09:45  Human approved
09:45  Arcade executed in dependency order
09:45  COMPLETE — 5/5 actions, 0 failures
```

That timeline — the **co-authorship trace** — is the primary artifact AIG
produces. The DAG visualization and the execution log are secondary surfaces.

---

## How it uses Arcade

AIG is a **complement** to Arcade, not a competitor. Arcade owns auth,
secure tool execution, and the OAuth lifecycle for 7,500+ tools. AIG owns
the pre-execution governance layer:

1. Plans are constructed using
   `client.tools.formatted.list({ format: 'anthropic', toolkit })` — the
   agent sees Arcade tool schemas directly.
2. The agent runs in plan-only mode. Tool `input` events are captured into
   an `Intent` (transactional grouping) — they are never executed.
3. After human approval, `client.tools.execute({ tool_name, input, user_id })`
   fires each call in dependency order. The `user_id` MUST equal the
   intent's `approved_by` field — auth propagation is enforced at the
   AIG layer before Arcade is touched.
4. Errors halt execution by default (`HALT_REMAINING`). See
   [ADR-0004](docs/adr/0004-halt-on-failure-rollback.md) for the rollback
   model.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router, RSC, SSE)                              │
│                                                                 │
│  Co-Authorship Timeline ◄──── SSE ──── /api/intents/[id]/stream │
│        ▲              ▲                                          │
│        │              │                                          │
│        │              └── mutate / approve                       │
│        │                                                         │
│  Intent Detail ──── /api/intents/[id]                            │
└────────────────────────────────────┬────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
       Plan Agent             Repair Engine          Executor
       (AI SDK 6 +            (AI SDK 6              (lib/aig +
        Claude Sonnet)         generateObject +      lib/arcade)
              │                zod-validated)              │
              │                      │                     │
              └──────────────────────┴─────────────────────┘
                               │
                               ▼
                    Drizzle ORM (PostgreSQL)
                    intents · tool_calls
                    mutations (append-only)
                    execution_records
                               │
                               ▼
                       Arcade MCP Engine
                       OAuth + tool execution
```

See [`docs/adr/`](docs/adr/) for the locked architectural decisions.

---

## Stack

| Layer       | Choice                              |
| ----------- | ----------------------------------- |
| Framework   | Next.js 16.2.6 + React 19.2.6       |
| TypeScript  | 5.9, strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes |
| Styling     | Tailwind CSS v4 + shadcn/ui         |
| AI          | Vercel AI SDK 6 + Anthropic Claude  |
| Tools       | @arcadeai/arcadejs v2.4             |
| Data        | Vercel Postgres + Drizzle ORM       |
| Validation  | zod v4 + @t3-oss/env-nextjs         |
| Quality     | Biome v2 (lint + format)            |
| Testing     | Vitest 4 + Playwright 1.60          |
| Hooks       | Lefthook + commitlint               |
| Logging     | pino (OTel-compatible)              |
| Deployment  | Vercel                              |

---

## Local setup

```bash
nvm use                 # Node 22
corepack enable
pnpm install
cp .env.example .env.local
# fill in DATABASE_URL, ANTHROPIC_API_KEY, ARCADE_API_KEY
pnpm db:push
pnpm dev
```

Probe your Arcade API key works:

```bash
pnpm probe:arcade
```

---

## Tests

```bash
pnpm test:unit          # lib/aig pure-module tests
pnpm test:eval          # repair eval harness (mock LLM)
pnpm test:eval:live     # repair eval harness (real Claude — the gate)
pnpm test:e2e           # Playwright with mocked Arcade
```

The repair eval gate: **9/9 cases must pass deterministically across 3
consecutive `EVAL_MODE=live` runs** before the UI is considered shippable.

---

## What is intentionally NOT in this codebase

- Risk scoring (replaced by deterministic `ImpactSummary`)
- Predictive execution preview (out of MVP scope)
- Semantic causality metadata on DAG edges
- Cross-window intent merging
- Multi-agent / multi-session concurrency
- RBAC / role policies
- Compensating-transaction rollback (designed in [ADR-0004](docs/adr/0004-halt-on-failure-rollback.md), not built)

Each omission has a reason. See [`AGENTS.md`](AGENTS.md) §8.

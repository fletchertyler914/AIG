# AIG — Arcade Intent Graph

> A pre-execution governance runtime for Arcade-powered AI agents.
> Agents propose. Humans constrain. The runtime repairs. Arcade executes.
> The negotiation is the artifact.

[ **Live demo → https://aig-eta.vercel.app** ] · [ 90-second video ] · [ Architecture ](docs/adr/)

---

## What this is

Most agent infrastructure shows you either:

- what the agent did (LangSmith, AgentOps — observability)
- what you configured the agent to do (n8n, Zapier — workflow)
- how the agent calls tools (LangGraph, OpenAI Agents — frameworks)

AIG shows you **how authority evolves between human and agent before
anything actually happens** — the negotiated execution layer that sits
above Arcade's MCP runtime and below your LLM.

### The loop (actual output from `pnpm live:loop` against real Claude)

```
1) POST /api/intents/demo
   intent=01KS80K0Z2B66MYNA20PG5NAB8  tool_calls=5

2) GET /api/intents/[id]
   status=PENDING_REVIEW
   label=Lead follow-up and next-step coordination
   tool calls:
     · Gmail.SendEmail@7.0.0           → deps=[0]
     · Gmail.SendEmail@7.0.0           → deps=[0]
     · GoogleCalendar.CreateEvent@3.3.2 → deps=[1]
     · GoogleCalendar.CreateEvent@3.3.2 → deps=[1]
     · Gmail.SendEmail@7.0.0           → deps=[2]

3) mutate — remove GoogleCalendar.CreateEvent@3.3.2

4) waiting for REGENERATING → PENDING_REVIEW
   status=PENDING_REVIEW
   trace:
     [0] agent/agent_proposed
     [1] human/human_removed
     [2] system/system_invalidated
     [3] agent/agent_regenerated

5) POST /api/intents/[id]/approve
6) status=APPROVED
   final trace:
     [0] agent/agent_proposed
     [1] human/human_removed
     [2] system/system_invalidated
     [3] agent/agent_regenerated
     [4] human/human_approved
```

That timeline — the **co-authorship trace** — is the primary artifact AIG
produces. The DAG visualization and the execution log are secondary surfaces.

---

## How it uses Arcade

AIG is a **complement** to Arcade, not a competitor. Arcade owns auth,
secure tool execution, and the OAuth lifecycle for 7,500+ tools. AIG owns
the pre-execution governance layer:

1. **Plan agent** — `client.tools.formatted.list({ format: 'anthropic', toolkit, user_id })`
   loads your authorized Arcade tools. Claude runs in **plan-only mode**:
   every `execute` short-circuits and captures `tool` + `args` — nothing
   hits a real account until you approve.
2. **Authorization surface** — `client.tools.authorize({ tool_name, user_id })`
   runs per unique tool. If OAuth is pending, the intent stays `UNCERTAIN`
   and the UI shows **Authorize Gmail / Calendar** links.
3. **Formation** — captured calls are grouped into a transactional intent
   with a locked objective, dependency DAG, and deterministic impact summary.
4. **Repair** — when you remove or edit a tool call, a fresh Claude session
   repairs downstream nodes while preserving approved and human-edited ones.
5. **Execution** — after approval, `client.tools.execute({ tool_name, input, user_id })`
   fires in topological order. `user_id` MUST equal `approved_by` — enforced
   at the AIG layer before Arcade is touched.

**Two entry points:**

| Path | Endpoint | When to use |
|------|----------|-------------|
| Real plan | `POST /api/intents` `{ prompt }` | Type what you want coordinated |
| Locked demo | `POST /api/intents/demo` | Reviewers: instant lead-followup scenario |

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
# fill in DATABASE_URL, ANTHROPIC_API_KEY, ARCADE_API_KEY, DEMO_USER_ID
# DEMO_USER_ID = your Arcade user_id (email) — OAuth is per-user in Arcade
pnpm db:push
pnpm dev
```

Probe your Arcade API key + run the loop against real models:

```bash
pnpm probe:arcade           # confirms Arcade key + lists authorized toolkits
pnpm live:plan "<prompt>"   # plan-agent → labeler → authorize on real Claude+Arcade
pnpm live:loop              # demo-route loop against dev server (create→remove→repair→approve)
pnpm live:prompt-loop "..." # full plan-driven loop against dev server
```

The `live:*` scripts are how this project was validated. Every iteration
in this codebase was driven by real Claude + real Arcade output, not just
mocks. See `scripts/live-*.ts` for the entry points.

---

## Tests

```bash
pnpm test:unit          # 77 pure-module tests (lib/aig, lib/ai, lib/arcade)
pnpm test:arcade:live   # real Arcade SDK + MCP gateway integration checks
pnpm test:eval          # 11 repair-engine cases (mock LLM, CI-fast)
pnpm test:eval:live     # 11 repair-engine cases vs real Claude (the gate)
pnpm test:e2e           # Playwright: dashboard → mutate → repair → approve → COMPLETE
```

Why E2E mocks Arcade: Playwright clicks **Approve**, which transitions into
execution. In CI, that must not send real emails or create real calendar
events. `test:e2e` therefore validates the UI, state machine, repair engine,
and executor with `E2E_MOCK_ARCADE=1`.

The real integration gate is separate and opt-in:

```bash
ARCADE_MCP_GATEWAY_URL="https://api.arcade.dev/mcp/agi" pnpm test:arcade:live
RUN_ARCADE_READONLY_EXECUTION=1 pnpm test:arcade:live
```

`test:arcade:live` hits real Arcade SDK endpoints (`tools.formatted.list`,
`tools.list`, `tools.authorize`) and the configured MCP gateway. It never
executes write tools. If `RUN_ARCADE_READONLY_EXECUTION=1` is set and
`Gmail.WhoAmI` is authorized, it also executes that read-only tool.

The repair eval gate: **11/11 contract+invariant assertions must pass
deterministically across 3 consecutive `EVAL_MODE=live` runs** before
any UI work ships. This repository was last validated at 11/11 × 3
on Claude 4.5 Sonnet.

End-to-end remains fully isolated from real Arcade via `E2E_MOCK_ARCADE=1`
(executor + authorize layers short-circuit), so the demo loop test exercises
the entire UI + state machine + executor without sending real email or
burning Claude credits.

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

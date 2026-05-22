# ADR-0001: Plan-then-execute over polling proxy

- Status: Accepted
- Date: 2026-05-22

## Context

AIG sits between an LLM agent and Arcade's MCP execution layer. Two integration
patterns are possible:

1. **Polling proxy**: the AIG SDK wraps Arcade tools. When the LLM emits a
   `tool_use` event, the wrapper captures the call, flushes the window, and
   long-polls until approval — then executes via Arcade and returns to the
   LLM. The agent loop pauses inside the SDK during human review.

2. **Plan-then-execute**: a route handler runs the agent in *plan-only* mode,
   collecting `tool_use` events without executing them. The plan is written
   to the DB and surfaced to the human. A separate route executes the plan
   via Arcade only after approval.

## Decision

**Plan-then-execute.** Polling proxy is incompatible with Vercel serverless
function durations (10s for hobby, 60s default for pro, 300s max). Human
review can take minutes. The polling model also forces the agent loop to
live in a long-running process, which contradicts the serverless deployment
target and complicates replay.

## Consequences

- Two route handlers: `POST /api/intents` (plan) and
  `POST /api/intents/[id]/approve` (execute). Both complete in seconds.
- The "regeneration" loop on mutation is a third route handler that calls
  the LLM again with the constrained repair prompt — also seconds.
- The agent never sees Arcade's actual response during planning. Tool
  definitions come from `client.tools.formatted.list({ format: 'anthropic' })`
  but the agent's tool execution is intercepted to capture, not to call.
- Replay reconstruction is straightforward — every state transition is a
  discrete API call with an append-only mutation log.
- The user-facing experience requires an SSE stream
  (`GET /api/intents/[id]/stream`) so timeline updates appear immediately.

## Alternatives considered

- Polling proxy SDK: rejected for the reasons above.
- Long-running edge worker: viable on Cloudflare Workers or fly.io, but
  changes the deployment story away from Vercel. Not worth it for MVP.

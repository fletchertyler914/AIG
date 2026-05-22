# ADR-0003: Claude structured output for repair

- Status: Accepted
- Date: 2026-05-22

## Context

The repair engine must produce a strictly-shaped JSON response
(`{ replace, preserve, remove }`). Options:

1. JSON mode / `generateText` + post-hoc JSON parsing.
2. AI SDK 6 `generateObject` with a zod schema (Anthropic structured output).
3. Direct Anthropic tool_use call with a custom `submit_repair` tool.

## Decision

**AI SDK 6 `generateObject` with zod schema.** AI SDK 6 has first-class
support for Anthropic's tool-use-based structured output. The SDK validates
the response against the zod schema and re-prompts on schema failures. This
gives us deterministic shape without writing our own retry logic.

## Consequences

- `lib/aig/repair.ts` calls `generateObject({ model, schema, prompt, system })`.
- The schema lives next to `repair.ts` and is the single source of truth for
  the response shape.
- The system prompt (`lib/aig/prompts/repair.system.md`) provides the
  invariants but does not need to describe the JSON shape — the schema does.
- Each call is a fresh session (no `messages` history).
- Failure modes: invalid output throws (zod parse failure surfaces) — we
  do not silently "fix" model outputs.

## Alternatives considered

- JSON mode + manual parsing: AI SDK 6 already handles this with built-in
  retries. No reason to re-invent.
- Raw Anthropic SDK with custom tool_use: skips AI SDK 6's tooling around
  agents, telemetry, and DevTools. Loses the upside of being on the latest
  spec.

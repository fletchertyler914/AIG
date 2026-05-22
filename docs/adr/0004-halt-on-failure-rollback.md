# ADR-0004: Halt-on-failure rollback for MVP

- Status: Accepted
- Date: 2026-05-22

## Context

A repaired and approved intent may execute 5+ tool calls across Gmail,
Calendar, Slack, CRM. If call 2 of 5 fails, what happens to the remaining
calls? Three options:

1. **Halt-on-failure**: stop, mark intent `PARTIAL_FAILURE`, surface to user.
2. **Compensate**: for each completed call, fire a compensating action
   (e.g. delete the calendar event we just created).
3. **Configurable per tool**: each tool declares its own rollback policy.

## Decision

**Halt-on-failure as the universal default for MVP.** Per-tool configurable
policy is supported in the schema (`tool_calls.rollback_policy` column) but
all MVP tools use `HALT_REMAINING`. True compensating transactions for
side-effectful SaaS actions (un-sending an email, un-posting a Slack message)
are largely fictional and require careful per-tool design.

## Consequences

- `lib/aig/executor.ts` stops execution on the first failure and writes an
  `arcade_failed` mutation.
- The intent moves to `PARTIAL_FAILURE` if any calls completed, or `FAILED`
  if none did.
- The UI surfaces the failed call and its error so a human can manually
  remediate.
- `COMPENSATE` is reserved in the schema and documented as future work in
  the README.

## Alternatives considered

- Always compensate: requires inverse-action design for every Arcade tool.
  Not feasible in 2 weeks and arguably impossible for many actions (you
  cannot un-send an email — only send a follow-up).
- Best-effort continue-past-failure: silently broken intents. Trust-killer.

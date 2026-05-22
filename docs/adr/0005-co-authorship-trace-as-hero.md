# ADR-0005: Co-authorship trace as the primary UI surface

- Status: Accepted
- Date: 2026-05-22

## Context

The MVP UI could surface three artifacts as the "hero":

1. The transactional intent graph (DAG visualization).
2. The execution log / replay (what Arcade did).
3. The co-authorship trace (the negotiation between human and agent).

## Decision

**The co-authorship trace is the hero.** Workflow tools (n8n, Zapier) already
own the graph surface. Observability tools (LangSmith, AgentOps) already own
the execution log surface. The unoccupied surface — and the genuinely novel
contribution — is the *negotiation* between human intent and agent
autonomy as a first-class, replayable artifact.

## Consequences

- The intent detail page (`app/(dashboard)/intent/[id]/page.tsx`) is a
  vertical timeline of `mutations` ordered by `mutation_index`. The DAG view
  is a secondary tab. Execution logs are tertiary and collapsed by default.
- Every mutation row reads as a narrative line:
  > 09:42 — Human removed `Calendar.CreateEvent` ("don't auto-schedule")
  > 09:43 — Agent regenerated downstream `Slack.SendMessage`
  > 09:44 — Human edited `Gmail.SendEmail.body` (Acme thread)
- The 90-second demo video is shot to make this timeline the centerpiece.

## Consequences for data model

- The `mutations` table is the primary source of truth for the UI.
- Every state change writes a mutation row — agent_proposed, human_removed,
  human_edited, agent_regenerated, human_approved, system_invalidated,
  arcade_executed, arcade_failed, system_expired.
- `mutations.mutation_index` is monotonic per intent (avoids same-ms ordering
  bugs that timestamp-only ordering hits).

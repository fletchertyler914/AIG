# Architecture Decision Records

Locked decisions for AIG. Read before changing stack pins, module boundaries,
auth, connections, or the intent lifecycle.

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](0001-plan-then-execute.md) | Plan-then-execute (no execution before approval) | Accepted |
| [0002](0002-drizzle-over-raw-sql.md) | Drizzle ORM over raw SQL | Accepted |
| [0003](0003-claude-structured-output-for-repair.md) | Claude structured output for repair | Accepted |
| [0004](0004-halt-on-failure-rollback.md) | Halt-on-failure execution (no compensating rollback in MVP) | Accepted |
| [0005](0005-co-authorship-trace-as-hero.md) | Co-authorship trace as primary artifact | Accepted |
| [0009](0009-control-plane-architecture.md) | Control plane: Better Auth, workspaces, connections | Accepted |
| [0010](0010-arcade-custom-verifier-and-connection-scope.md) | Custom Arcade verifier + personal/shared connections | Accepted (amended for dev/prod mode + scoped removal) |

## When to add an ADR

- Changes a stack invariant in `AGENTS.md` §2
- Breaks or extends a module boundary in §3
- Supersedes a decision in this table
- Ships something from `AGENTS.md` §8 "intentionally NOT built"

Use `NNNN-kebab-title.md`, include **Status**, **Context**, **Decision**,
**Consequences**, and link related ADRs.

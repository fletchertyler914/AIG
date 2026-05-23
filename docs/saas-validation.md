# SaaS Validation Playbook

The goal of this doc is to figure out whether AIG should become a real SaaS
business **before** committing to the architecture in ADR-0011. Build only
what the next validation step needs. Treat every section here as a falsifiable
hypothesis with a clear "stop building, change direction" exit.

This is a living document. Update it as evidence accumulates.

---

## 0. Premise to validate

> Teams deploying AI agents on Arcade need a governance layer between the
> agent's plan and Arcade's execution. They will pay for it, bring their own
> Arcade project, and let it sit on their critical path in production.

Three implicit sub-claims that must each survive contact with reality:

1. **Real teams are running agents on Arcade in production.** Not demos. Not
   weekend hacks. Recurring agent workloads with real consequences.
2. **They want pre-execution governance** (approve / repair / audit) and not
   just observability after the fact.
3. **They will pay $X/month** for it — where $X is large enough to cover
   infra + a person's time.

If any one of these is false, the SaaS thesis dies. Validation work is about
forcing fast, cheap answers to each.

---

## 1. The demo (what to show this month)

Goal: a 5-minute live walkthrough that makes a sophisticated agent builder say
"oh, I've felt that pain — when can I use it?"

### Required surfaces

- **Landing page** that opens with the *problem*, not the product. The hero
  line should be felt-in-the-chest, not generic ("Your agent just sent the
  email to the wrong customer. Now what?" beats "AI governance for Arcade").
  Pair with a 30-second loom embedded above the fold.
- **Sandbox sign-in** via magic link with an instant, opinionated experience:
  - Auto-create a workspace called "Sandbox".
  - Seed a Gmail-flavored pipeline (already shipped — extend it to two
    pipelines so the dashboard doesn't look empty).
  - Pre-populate one resolved intent with a co-authorship trace so the trace
    drawer has something to show.
- **The 60-second hero loop:**
  1. Type a natural-language goal.
  2. Watch the DAG render with one auth-blocked node.
  3. Click "Authorize" → connect Gmail → node turns green live.
  4. Edit one tool-call arg in the side panel.
  5. Approve.
  6. Open the trace drawer and point at the AI + human co-authorship rows.
- **One real approval-policy rule** pre-installed: `Gmail.SendEmail*` →
  `require_admin_approval`. Try to approve as a non-admin to demonstrate the
  gate. This is what differentiates AIG from "another agent demo."

### What *not* to show

- The repair eval harness. Internal quality bar, not a demo asset.
- Connections settings unless someone asks.
- Insights graphs while the data is faked — empty charts read as "this is
  vapor."

### Demo prep checklist

- [ ] Custom domain bound (`arcadeintentgraph.xyz`).
- [ ] Resend sender domain verified.
- [ ] Production Arcade verifier + Google OAuth credentials installed.
- [ ] One curated Loom recording of the 60-second hero loop.
- [ ] Sandbox onboarding hits "first approved intent" in < 3 minutes for a
      cold user. Time yourself with a stopwatch from a fresh incognito
      window. If it's slower, fix that before doing anything else.
- [ ] Working email + status page (statuspage.io free tier is fine).

---

## 2. Test-the-waters experiments (run in parallel with the demo)

Each experiment is cheap (hours to days), generates a clear signal, and has
an explicit "what would change my mind" exit.

### Experiment A — Audience signal

**Hypothesis:** there are at least 100 builders on Arcade actively looking for
governance / audit / approval tooling.

**Test:**
- Post a single thoughtful Twitter/X thread + LinkedIn post with the demo
  Loom and a "join the waitlist" CTA. No CTA copy beyond "early access."
- Cross-post in the Arcade Discord / Slack (ask permission first).
- Email 10 known agent builders directly with a personalized note.

**Signal:**
- 25+ waitlist signups in week 1 → keep going.
- 5–24 → noisy, follow up with everyone individually before committing.
- < 5 → the audience may not exist on this channel. Try Arcade's developer
  newsletter or partner with Arcade directly before declaring failure.

**Time-boxed:** 2 weeks max.

---

### Experiment B — Design-partner conversations

**Hypothesis:** 3+ teams will commit to using AIG against their *real* Arcade
project within 30 days, in exchange for free access + direct support.

**Test:**
- Reach out to every waitlist signup who lists a company.
- 30-minute call. **Don't demo first** — ask:
  - "Tell me about the last agent you shipped to production."
  - "What broke? What were you afraid of?"
  - "Do you have approvals or audit today? How?"
  - "If a teammate built a bad agent, how would you know before it ran?"
- Demo only after they've described pain. Look for unprompted reactions
  ("oh that's what I need" vs "neat") — the words matter less than whether
  they ask "when can I try this?"

**Signal:**
- 3+ teams say "yes, install us today" → commit to building Phase 1 of
  ADR-0011 (BYO Arcade + RLS + envelope encryption).
- 1–2 teams + a clear pattern in the "no" answers → tighten the pitch and run
  10 more conversations.
- 0 teams after 15 conversations → the problem isn't acute enough. Pivot the
  positioning or the persona.

**Time-boxed:** 30 days.

---

### Experiment C — Pricing reaction

**Hypothesis:** at least one design partner will say "yes" to a $200/seat or
$500/workspace price after 30 days of free usage.

**Test:**
- At the end of the design-partner trial, present a written one-pager:
  - "Here's what we built together."
  - "Here's what it would cost to keep using it."
  - Three columns: Free / Pro $X / Enterprise (call).
- Do not negotiate during the call. Ask: "Where does this land relative to
  what you'd expect?"

**Signal:**
- "We'd pay that, send the invoice" → pricing thesis holds, build Stripe.
- "We'd pay it but more like half" → useful — note the framing they used.
- "We'd never pay for this" with no qualifier → the thesis or the persona
  is wrong; do not build billing yet.

**Time-boxed:** ends each design partner's 30-day trial.

---

### Experiment D — Concierge BYO Arcade

**Hypothesis:** customers will hand over their Arcade API key to a multi-tenant
SaaS — *if* the security posture is clearly communicated.

**Test:** Before building real BYO Arcade infra (Phase 1 of ADR-0011), run it
**manually** for the first 2–3 design partners:
- Have them create an Arcade project + API key.
- Store the key in a dedicated **per-customer Vercel project** with the key
  in their own Vercel env. (Yes, a separate Vercel deployment per customer.
  Painful, but it forces the cleanest possible isolation story and gives you
  a real-world test of the customer's reaction.)
- Or: paste it into a 1Password vault you and the customer share; you set it
  as an env var on a per-customer ephemeral workspace.

**Signal:**
- They share the key without flinching → BYO Arcade is a viable upgrade path.
  Build the real infra.
- They demand SOC 2, BYO KMS, or "no shared infra" before they'll share a key
  → either skip BYO Arcade and only sell to teams running self-hosted, or
  accelerate the Enterprise tier (which is a much bigger build).
- They have no Arcade project and don't want one → AIG is dependent on
  Arcade's adoption curve. Consider being upstream of Arcade adoption (offer
  AIG as the *reason* to adopt Arcade, partnered with their team).

**Time-boxed:** lifetime of the first 3 design partners.

---

## 3. What to build vs. what to fake

The validation experiments above intentionally avoid forcing builds. Most of
ADR-0011 should remain unbuilt until a design partner blocks on it.

| Capability | Build now? | Defer until |
| ---------- | ---------- | ----------- |
| Sandbox sign-in + seeded pipeline + 60-sec hero loop | **Yes** | — |
| Magic link + custom domain + Resend production | **Yes** | — |
| Status page, security.txt, basic disclosure policy | **Yes** | — |
| Single-tenant approval policies (already shipped) | **Done** | — |
| Audit log surface (UI list view of mutations) | **Yes** | — |
| BYO Arcade per workspace (real, not concierge) | No | First paying customer commits |
| Stripe Billing + entitlement gates | No | First "yes, send invoice" |
| RLS on tenant tables | No | First *production* (non-sandbox) workspace |
| Envelope-encrypted secrets | No | Same trigger as BYO Arcade |
| Public REST API + OpenAPI | No | A design partner asks for it twice |
| Webhooks | No | A design partner asks for it twice |
| SSO / SCIM | No | First Enterprise contract is in motion |
| SOC 2 audit kickoff | No | First contract requires it |

---

## 4. Demo / sales narrative cheat sheet

Use the same words every time. Inconsistency kills positioning.

- **Tagline:** "Pre-execution governance for Arcade agents."
- **One-line product:** "AIG sits between your agent's plan and Arcade's
  execution. Humans inspect, repair, and approve transactional intents before
  they touch real systems."
- **The wedge:** approval policies + co-authorship trace. Not workflow
  building. Not observability. Not another agent framework.
- **The "why now":** Arcade just made it trivial to give agents access to
  7,000 tools. AIG is the layer that makes that *safe* to ship.
- **The competitive frame:** not "vs LangSmith" (that's after-the-fact
  observability) and not "vs Zapier" (that's deterministic workflows). Closest
  comparable is **change management for code reviewing**, but for agent
  intents.

---

## 5. Anti-patterns to avoid

1. **Building tier-3 enterprise features first** because they sound serious.
   No SOC 2, no SSO, no BYO KMS until a customer is paying.
2. **Confusing waitlist signups with revenue.** A list of emails is one
   signal; a credit card is another. Treat them differently.
3. **Custom demos for every prospect.** If the sandbox can't sell itself in 5
   minutes, the product isn't ready, not the demo.
4. **Hiding behind a "request demo" form on the landing page.** Sandbox-first
   self-serve is the demo. Make it embarrassingly fast to try.
5. **Building Stripe before pricing is validated.** A Notion page with
   "contact us" buttons next to the tier columns is enough for the first 10
   customers.
6. **Confusing engineering polish with product progress.** Three more
   approval-policy actions ≠ three more paying customers.

---

## 6. Decision points

These are the moments where validation forces an architecture decision.

| Trigger | Decision |
| ------- | -------- |
| 3+ design partners onboarded via concierge BYO | Start Phase 1 of ADR-0011 (real BYO Arcade + secrets + RLS). |
| First "yes, send the invoice" | Start Phase 2 (Stripe Billing + entitlements). |
| Second design partner asks for "an API" without prompting | Start Phase 3 (REST API + OpenAPI + first SDK). |
| First Enterprise lead asks for SSO + DPA | Start Phase 4 (SSO/SCIM + audit export + DPA + SOC 2 kickoff). |
| 0 paying customers after 6 months of trying | Stop. Reassess persona, ICP, or thesis. Don't keep shipping features into the void. |

---

## 7. Open questions worth answering before Phase 1

- Are there Arcade customers we can co-market with for distribution? (Ask
  Arcade directly.)
- Is the right ICP "platform team at a company shipping agents to customers"
  or "the agent builder themselves"? Different pricing and different demos.
- Is approval/audit a *purchase* trigger or a *retention* feature? If the
  latter, what's the wedge that gets them in the door?
- Is "intent" the right primitive name for the buyer, or do they think in
  "runs" / "executions" / "transactions"? Vocabulary matters more than logos.

When two design partners give the same answer to any of these, write it down
and design around it.

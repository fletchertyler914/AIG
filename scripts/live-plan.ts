/**
 * Live plan-agent harness.
 *
 *   pnpm tsx scripts/live-plan.ts "<prompt>" [toolkit1,toolkit2,...]
 *
 * Runs the plan agent against real Claude + real Arcade and prints what
 * was captured plus the labeler + authorize output. Iterate on prompts
 * and prompt engineering here without spinning up the dev server.
 */

import { createLlmLabeler } from '@/lib/ai/labeler'
import { runPlanAgent } from '@/lib/ai/plan-agent'
import { formCandidateIntent } from '@/lib/aig/formation'
import { authorizeMany } from '@/lib/arcade/authorize'
import { env } from '@/lib/env'

const prompt =
  process.argv[2] ??
  'Follow up with the open Acme and Globex leads — send a short email to each and schedule a 30-minute intro call next week.'

const toolkits = (process.argv[3]?.split(',') ?? ['Gmail', 'GoogleCalendar']).map((t) => t.trim())

function pretty(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}

async function main() {
  const t0 = Date.now()
  console.log('\n── PROMPT ─────────────────────────────────────────────')
  console.log(prompt)
  console.log('── TOOLKITS ───────────────────────────────────────────')
  console.log(toolkits.join(', '))
  console.log('── USER ───────────────────────────────────────────────')
  console.log(env.DEMO_USER_ID)
  console.log()

  console.log('Running plan agent...')
  const plan = await runPlanAgent({
    prompt,
    userId: env.DEMO_USER_ID,
    toolkits,
    maxSteps: 8,
  })
  const t1 = Date.now()

  console.log(`\n── PLAN AGENT (${t1 - t0}ms) ─────────────────────────`)
  console.log(`captured calls: ${plan.calls.length}`)
  console.log(`agent text: ${plan.text || '<none>'}`)
  for (const [i, c] of plan.calls.entries()) {
    console.log(`\n[${i}] ${c.tool}`)
    console.log(pretty(c.args))
  }

  if (plan.calls.length === 0) {
    console.log('\n⚠️  No tool calls captured. Iterate on the prompt or system prompt.')
    return
  }

  console.log('\nRunning labeler...')
  const labeler = createLlmLabeler({ userPrompt: prompt })
  const candidate = await formCandidateIntent({ calls: plan.calls, labeler })
  const t2 = Date.now()

  console.log(`\n── LABELER (${t2 - t1}ms) ────────────────────────────`)
  console.log(`label:        ${candidate.label}`)
  console.log(`description:  ${candidate.description}`)
  console.log(`objective:    ${candidate.objective}`)
  console.log(`confidence:   ${candidate.confidence.toFixed(2)}`)
  console.log(`systems:      ${candidate.systems.join(', ')}`)
  console.log('dependencies:')
  for (const [i, tc] of candidate.toolCalls.entries()) {
    console.log(`  [${i}] ${tc.tool} ← [${tc.dependsOn.join(', ')}]`)
  }

  console.log('\nRunning authorize on captured tools...')
  const auths = await authorizeMany(
    candidate.toolCalls.map((c) => c.tool),
    env.DEMO_USER_ID,
  )
  const t3 = Date.now()

  console.log(`\n── AUTHORIZE (${t3 - t2}ms) ──────────────────────────`)
  for (const a of auths) {
    const status = a.status === 'completed' ? '✓' : '⚠'
    console.log(`${status} ${a.tool} → ${a.status}${a.url ? `\n    ${a.url}` : ''}`)
  }

  console.log(`\nTotal: ${t3 - t0}ms`)
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('\n❌ live-plan failed:')
    console.error(err instanceof Error ? err.stack : err)
    process.exit(1)
  })

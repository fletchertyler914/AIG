/**
 * Live loop against the running dev server, but using the real plan agent
 * via POST /api/intents (not the deterministic demo route).
 *
 *   pnpm tsx scripts/live-prompt-loop.ts "<prompt>"
 *
 * This validates the full prompt-driven path including Arcade authorize
 * surface and the LLM labeler/repair pipeline.
 */

export {}

const BASE = process.env['AIG_BASE_URL'] ?? 'http://localhost:3000'
const PROMPT =
  process.argv[2] ??
  'Follow up with the Acme and Globex leads — send one email to each, schedule a 30-minute intro call next week, and send me a recap email when done.'

interface IntentRef {
  intentId: string
  toolCallIds: string[]
}

interface ToolCallDto {
  id: string
  tool: string
  args: Record<string, unknown>
  status: string
  dependsOn: string[]
}

interface IntentTraceDto {
  intent: {
    id: string
    status: string
    label: string
    objective: string
    description: string
    impact: { bySystem?: Record<string, number>; pendingAuthorizations?: unknown[] }
  }
  toolCalls: ToolCallDto[]
  mutations: Array<{ mutationIndex: number; type: string; actor: string }>
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`)
  }
  return (await res.json()) as T
}

async function waitFor(
  id: string,
  pred: (i: IntentTraceDto) => boolean,
  timeoutMs = 60_000,
): Promise<IntentTraceDto> {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const intent = await http<IntentTraceDto>(`/api/intents/${id}`)
    if (pred(intent)) return intent
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`timed out waiting for intent ${id}`)
}

async function main() {
  console.log(`▶ AIG live prompt loop @ ${BASE}\n`)
  console.log(`PROMPT: ${PROMPT}\n`)

  const t0 = Date.now()

  console.log('1) POST /api/intents (plan agent)')
  const ref = await http<IntentRef>('/api/intents', {
    method: 'POST',
    body: JSON.stringify({ prompt: PROMPT }),
  })
  const t1 = Date.now()
  console.log(`   intent=${ref.intentId}  tool_calls=${ref.toolCallIds.length}  (${t1 - t0}ms)\n`)

  console.log('2) initial trace')
  let intent = await http<IntentTraceDto>(`/api/intents/${ref.intentId}`)
  console.log(`   status=${intent.intent.status}`)
  console.log(`   label=${intent.intent.label}`)
  console.log(`   objective=${intent.intent.objective}`)
  console.log(`   description=${intent.intent.description}`)
  if (intent.intent.impact.pendingAuthorizations?.length) {
    console.log(`   ⚠ pending OAuth for ${intent.intent.impact.pendingAuthorizations.length} tools`)
  }
  console.log('   tool calls:')
  for (const tc of intent.toolCalls) {
    const args = JSON.stringify(tc.args).slice(0, 90)
    console.log(`     · ${tc.tool}  deps=${tc.dependsOn.length}`)
    console.log(`       ${args}${args.length === 90 ? '…' : ''}`)
  }
  console.log()

  // Pick a tool call to remove that has dependents
  const target = intent.toolCalls.find((tc) =>
    intent.toolCalls.some((other) => other.dependsOn.includes(tc.id)),
  )

  if (!target) {
    console.log('⚠ no tool call with dependents found; skipping mutate step')
  } else {
    console.log(`3) mutate — remove ${target.tool}`)
    await http(`/api/intents/${ref.intentId}/mutate`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'remove',
        toolCallId: target.id,
        reason: 'live-prompt-loop: validate repair end-to-end',
      }),
    })

    console.log('4) waiting for repair...')
    const tRepair0 = Date.now()
    intent = await waitFor(
      ref.intentId,
      (i) => i.intent.status === 'PENDING_REVIEW' || i.intent.status === 'MODIFIED',
    )
    console.log(`   repaired in ${Date.now() - tRepair0}ms; status=${intent.intent.status}`)
    console.log('   trace:')
    for (const m of intent.mutations) {
      console.log(`     [${m.mutationIndex}] ${m.actor}/${m.type}`)
    }
    console.log()

    console.log('5) final tool calls (post-repair):')
    for (const tc of intent.toolCalls) {
      console.log(`     · status=${tc.status.padEnd(12)} ${tc.tool}`)
    }
  }

  console.log(`\n✓ live prompt loop complete  ${Date.now() - t0}ms`)
}

main().catch((err: unknown) => {
  console.error('\n✗ live prompt loop failed:')
  console.error(err instanceof Error ? err.stack : err)
  process.exit(1)
})

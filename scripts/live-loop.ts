/**
 * Live demo loop against a running AIG instance.
 *
 *   pnpm tsx scripts/live-loop.ts
 *
 * Exercises:
 *   1. POST /api/intents/demo (deterministic fast-path)
 *   2. GET  /api/intents/[id]
 *   3. POST /api/intents/[id]/mutate (remove a calendar tool call)
 *   4. wait for REGENERATING → PENDING_REVIEW
 *   5. POST /api/intents/[id]/approve (skipExecute=true so we don't touch real Arcade)
 *   6. GET  /api/intents/[id] (final trace)
 *
 * Designed to be safe: skipExecute=true means no real emails/calendar
 * events are sent. To exercise actual Arcade execution, run the demo
 * via the UI after authorizing your toolkits.
 */

export {}

const BASE = process.env['AIG_BASE_URL'] ?? 'http://localhost:3000'

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
  locked: boolean
}

interface MutationDto {
  mutationIndex: number
  type: string
  actor: string
  payload: Record<string, unknown>
}

interface IntentWithTrace {
  intent: { id: string; status: string; label: string; objective: string }
  toolCalls: ToolCallDto[]
  mutations: MutationDto[]
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
  intentId: string,
  pred: (i: IntentWithTrace) => boolean,
  timeoutMs = 30_000,
): Promise<IntentWithTrace> {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const intent = await http<IntentWithTrace>(`/api/intents/${intentId}`)
    if (pred(intent)) return intent
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`timed out waiting for intent ${intentId}`)
}

async function main() {
  console.log(`▶ AIG live loop @ ${BASE}\n`)

  // 1. Create demo intent
  console.log('1) POST /api/intents/demo')
  const created = await http<IntentRef>('/api/intents/demo', { method: 'POST' })
  console.log(`   intent=${created.intentId}  tool_calls=${created.toolCallIds.length}\n`)

  // 2. Fetch initial state
  console.log('2) GET /api/intents/[id]')
  let intent = await http<IntentWithTrace>(`/api/intents/${created.intentId}`)
  console.log(`   status=${intent.intent.status}`)
  console.log(`   label=${intent.intent.label}`)
  console.log('   tool calls:')
  for (const tc of intent.toolCalls) {
    console.log(`     · ${tc.id.slice(0, 8)}  ${tc.tool}  → deps=[${tc.dependsOn.length}]`)
  }
  console.log()

  // 3. Pick a calendar event to remove (one that has dependents)
  const target = intent.toolCalls.find(
    (tc) =>
      tc.tool.startsWith('GoogleCalendar') &&
      intent.toolCalls.some((other) => other.dependsOn.includes(tc.id)),
  )
  if (!target) {
    throw new Error(
      'expected at least one calendar tool call with a downstream dependent for the repair demo',
    )
  }
  console.log(`3) POST /api/intents/[id]/mutate — remove ${target.id.slice(0, 8)} (${target.tool})`)
  await http(`/api/intents/${created.intentId}/mutate`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'remove',
      toolCallId: target.id,
      reason: 'live-loop: demonstrate constrained regeneration',
    }),
  })
  console.log()

  // 4. Wait for repair to complete and intent to return to PENDING_REVIEW
  console.log('4) waiting for REGENERATING → PENDING_REVIEW')
  intent = await waitFor(
    created.intentId,
    (i) => i.intent.status === 'PENDING_REVIEW' || i.intent.status === 'MODIFIED',
  )
  console.log(`   status=${intent.intent.status}`)
  console.log('   trace:')
  for (const m of intent.mutations) {
    console.log(`     [${m.mutationIndex}] ${m.actor}/${m.type}`)
  }
  console.log()

  // 5. Approve (execute:false — just exercise the state machine, no real Arcade calls)
  console.log('5) POST /api/intents/[id]/approve  execute=false')
  await http(`/api/intents/${created.intentId}/approve`, {
    method: 'POST',
    body: JSON.stringify({
      approvedBy: process.env['DEMO_USER_ID'] ?? 'fletchertyler914@gmail.com',
      execute: false,
    }),
  })
  console.log()

  // 6. Final state
  console.log('6) GET /api/intents/[id]  (final)')
  intent = await http<IntentWithTrace>(`/api/intents/${created.intentId}`)
  console.log(`   status=${intent.intent.status}`)
  console.log('   final trace:')
  for (const m of intent.mutations) {
    console.log(`     [${m.mutationIndex}] ${m.actor}/${m.type}`)
  }

  console.log('\n✓ live loop complete')
}

main().catch((err: unknown) => {
  console.error('\n✗ live loop failed:')
  console.error(err instanceof Error ? err.stack : err)
  process.exit(1)
})

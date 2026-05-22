import { expireIfNeeded } from '@/lib/aig/expire'
import { getIntentWithTrace } from '@/lib/db/queries'
import {
  intentSnapshotFingerprint,
  syncAuthorizationIfNeeded,
} from '@/lib/intent/authorization-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadSnapshot(intentId: string) {
  await syncAuthorizationIfNeeded(intentId)
  let snapshot = await getIntentWithTrace(intentId)
  if (!snapshot) return null

  const newStatus = await expireIfNeeded(snapshot.intent)
  if (newStatus !== snapshot.intent.status) {
    snapshot = await getIntentWithTrace(intentId)
  }
  return snapshot
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let lastFingerprint = ''

      while (!request.signal.aborted) {
        const snapshot = await loadSnapshot(id)
        if (!snapshot) {
          controller.enqueue(
            encoder.encode('event: error\\ndata: {"error":"Intent not found"}\\n\\n'),
          )
          break
        }

        const fingerprint = intentSnapshotFingerprint(snapshot)
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint
          controller.enqueue(
            encoder.encode(`event: intent\\ndata: ${JSON.stringify(snapshot)}\\n\\n`),
          )
        } else {
          controller.enqueue(encoder.encode(': heartbeat\\n\\n'))
        }

        await sleep(1_000)
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

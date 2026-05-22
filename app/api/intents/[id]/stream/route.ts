import { getIntentWithTrace } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let lastMutationCount = -1

      while (!request.signal.aborted) {
        const snapshot = await getIntentWithTrace(id)
        if (!snapshot) {
          controller.enqueue(
            encoder.encode('event: error\\ndata: {"error":"Intent not found"}\\n\\n'),
          )
          break
        }

        if (snapshot.mutations.length !== lastMutationCount) {
          lastMutationCount = snapshot.mutations.length
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

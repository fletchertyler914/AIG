'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { IntentDto } from '@/components/intent/types'

interface ListResponse {
  intents: IntentDto[]
}

async function listIntents(): Promise<IntentDto[]> {
  const res = await fetch('/api/intents', { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  const body = (await res.json()) as ListResponse
  return body.intents
}

export function IntentDashboard() {
  const router = useRouter()
  const [intents, setIntents] = useState<IntentDto[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    void listIntents()
      .then(setIntents)
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load intents')
      })
  }, [])

  const createDemoIntent = () => {
    startTransition(async () => {
      const res = await fetch('/api/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Follow up with my open leads and get next steps scheduled.',
          userId: 'fletchertyler914@gmail.com',
        }),
      })

      if (!res.ok) {
        toast.error(await res.text())
        return
      }

      const body = (await res.json()) as { intentId: string }
      router.push(`/intent/${body.intentId}`)
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="space-y-4">
        <p className="font-mono text-aig-proposed text-xs uppercase tracking-widest">
          Arcade Intent Graph
        </p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">
              Transactional governance for Arcade-powered agents.
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Agents propose. Humans constrain. The runtime repairs. Arcade executes. The
              negotiation is the artifact.
            </p>
          </div>
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm disabled:opacity-50"
            disabled={isPending}
            onClick={createDemoIntent}
            type="button"
          >
            Create demo intent
          </button>
        </div>
      </header>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="font-semibold text-xl">Recent intents</h2>
        {intents.length === 0 ? (
          <p className="mt-3 text-muted-foreground text-sm">
            No intents yet. Create the lead follow-up demo to start the co-authorship trace.
          </p>
        ) : (
          <div className="mt-4 divide-y">
            {intents.map((intent) => (
              <Link
                className="flex items-center justify-between gap-4 py-4 transition hover:text-aig-approved"
                href={`/intent/${intent.id}`}
                key={intent.id}
              >
                <div>
                  <h3 className="font-medium">{intent.label}</h3>
                  <p className="mt-1 text-muted-foreground text-sm">{intent.description}</p>
                </div>
                <span className="rounded-full border px-3 py-1 font-mono text-xs uppercase">
                  {intent.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

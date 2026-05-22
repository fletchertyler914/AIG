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

const PROMPT_PLACEHOLDER =
  'e.g. Follow up with the open Acme and Globex leads — send a short email to each and schedule an intro call next week.'

const EXAMPLE_PROMPTS: ReadonlyArray<string> = [
  'Follow up with the open Acme and Globex leads — send a short email to each and schedule an intro call next week.',
  'Draft a summary of my latest commits on the AIG repo and email it to my manager.',
  'Email the design review notes to alice@example.com and add a 30-minute follow-up to my calendar tomorrow.',
]

export function IntentDashboard() {
  const router = useRouter()
  const [intents, setIntents] = useState<IntentDto[]>([])
  const [prompt, setPrompt] = useState('')
  const [isPlanning, startPlanning] = useTransition()
  const [isRunningDemo, startDemo] = useTransition()

  useEffect(() => {
    void listIntents()
      .then(setIntents)
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load intents')
      })
  }, [])

  const runPlan = () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      toast.error('Type what you want the agent to coordinate first.')
      return
    }
    startPlanning(async () => {
      const res = await fetch('/api/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      const body = (await res.json()) as { intentId: string }
      router.push(`/intent/${body.intentId}`)
    })
  }

  const runDemo = () => {
    startDemo(async () => {
      const res = await fetch('/api/intents/demo', { method: 'POST' })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      const body = (await res.json()) as { intentId: string }
      router.push(`/intent/${body.intentId}`)
    })
  }

  const busy = isPlanning || isRunningDemo

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="space-y-4">
        <p className="font-mono text-aig-proposed text-xs uppercase tracking-widest">
          Arcade Intent Graph
        </p>
        <div className="max-w-3xl">
          <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">
            Transactional governance for Arcade-powered agents.
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Agents propose. Humans constrain. The runtime repairs. Arcade executes. The negotiation
            is the artifact.
          </p>
        </div>
      </header>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-semibold text-xl">Plan a multi-tool intent</h2>
          <button
            className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={runDemo}
            type="button"
          >
            {isRunningDemo ? 'Loading…' : 'or replay the locked demo →'}
          </button>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Claude reasons over your authorized Arcade toolkits, captures the plan without executing
          it, and AIG forms a transactional intent you can review.
        </p>

        <textarea
          className="mt-4 min-h-[112px] w-full rounded-md border bg-background p-3 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          disabled={busy}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              runPlan()
            }
          }}
          placeholder={PROMPT_PLACEHOLDER}
          value={prompt}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              className="rounded-full border bg-muted px-3 py-1 text-muted-foreground text-xs transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
              disabled={busy}
              key={example}
              onClick={() => setPrompt(example)}
              type="button"
            >
              {example.slice(0, 64)}
              {example.length > 64 ? '…' : ''}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">⌘</kbd>
            <span className="mx-1">+</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Enter</kbd>
            <span className="ml-2">to plan.</span>
          </p>
          <button
            className="rounded-md bg-primary px-5 py-2 text-primary-foreground text-sm shadow-sm disabled:opacity-50"
            disabled={busy}
            onClick={runPlan}
            type="button"
          >
            {isPlanning ? 'Planning…' : 'Run plan'}
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="font-semibold text-xl">Recent intents</h2>
        {intents.length === 0 ? (
          <p className="mt-3 text-muted-foreground text-sm">
            No intents yet. Plan one above, or replay the locked demo to see the loop.
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

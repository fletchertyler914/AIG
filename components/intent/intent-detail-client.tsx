'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ToolCallCard } from '@/components/intent/tool-call-card'
import type { IntentWithTraceDto } from '@/components/intent/types'
import { asRecord } from '@/components/intent/types'
import { CoAuthorshipTimeline } from '@/components/timeline/co-authorship-timeline'

interface IntentDetailClientProps {
  intentId: string
}

interface PendingAuthorization {
  tool: string
  url?: string
  providerId?: string
  status?: string
}

function readPendingAuthorizations(impact: Record<string, unknown>): PendingAuthorization[] {
  const raw = impact['pendingAuthorizations']
  if (!Array.isArray(raw)) return []
  const out: PendingAuthorization[] = []
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const tool = String(r['tool'] ?? '')
    if (!tool) continue
    const entry: PendingAuthorization = { tool }
    if (typeof r['url'] === 'string') entry.url = r['url']
    if (typeof r['providerId'] === 'string') entry.providerId = r['providerId']
    if (typeof r['status'] === 'string') entry.status = r['status']
    out.push(entry)
  }
  return out
}

function toolkitLabel(tool: string): string {
  const dot = tool.indexOf('.')
  return dot === -1 ? tool : tool.slice(0, dot)
}

async function fetchIntent(intentId: string): Promise<IntentWithTraceDto> {
  const res = await fetch(`/api/intents/${intentId}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as IntentWithTraceDto
}

export function IntentDetailClient({ intentId }: IntentDetailClientProps) {
  const [data, setData] = useState<IntentWithTraceDto | null>(null)
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setData(await fetchIntent(intentId))
  }, [intentId])

  useEffect(() => {
    void refresh()

    const source = new EventSource(`/api/intents/${intentId}/stream`)
    source.addEventListener('intent', (event) => {
      const message = event as MessageEvent<string>
      setData(JSON.parse(message.data) as IntentWithTraceDto)
    })
    source.addEventListener('error', () => {
      source.close()
    })
    return () => source.close()
  }, [intentId, refresh])

  const approve = () => {
    startTransition(async () => {
      const res = await fetch(`/api/intents/${intentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'fletchertyler914@gmail.com', execute: true }),
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      toast.success('Intent approved — Arcade execution started.')
      await refresh()
    })
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted-foreground">Loading intent...</p>
      </main>
    )
  }

  const impact = asRecord(data.intent.impact)
  const bySystem = asRecord(impact['bySystem'])
  const pendingAuths = readPendingAuthorizations(impact)
  const agentSummary = typeof impact['agentSummary'] === 'string' ? impact['agentSummary'] : null

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link className="text-muted-foreground text-sm hover:text-foreground" href="/">
              ← Back
            </Link>
            <h1 className="mt-3 font-semibold text-3xl tracking-tight" data-testid="intent-label">
              {data.intent.label}
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">{data.intent.description}</p>
            <p className="mt-3 rounded-md border bg-muted p-3 text-sm">
              <span className="font-medium">Locked objective:</span> {data.intent.objective}
            </p>
            {agentSummary ? (
              <p className="mt-2 text-muted-foreground text-sm">
                <span className="font-medium text-foreground">Agent summary:</span> {agentSummary}
              </p>
            ) : null}
          </div>
          <div className="space-y-2 text-right">
            <span
              className="inline-flex rounded-full border px-3 py-1 font-mono text-xs uppercase"
              data-testid="intent-status"
            >
              {data.intent.status}
            </span>
            <div>
              <button
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm disabled:opacity-50"
                data-testid="approve-button"
                disabled={isPending || data.intent.status !== 'PENDING_REVIEW'}
                onClick={approve}
                type="button"
              >
                Approve intent
              </button>
            </div>
          </div>
        </div>

        {pendingAuths.length > 0 ? (
          <section className="rounded-lg border border-aig-modified/40 bg-aig-modified/5 p-4">
            <p className="font-mono text-aig-modified text-xs uppercase tracking-widest">
              Arcade authorization required
            </p>
            <p className="mt-1 text-sm">
              The plan referenced toolkits this Arcade user has not yet authorized. Complete the
              OAuth flows below, then refresh — the intent will move out of UNCERTAIN.
            </p>
            <ul className="mt-3 space-y-2">
              {pendingAuths.map((auth) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm"
                  key={auth.tool}
                >
                  <div>
                    <p className="font-medium">{toolkitLabel(auth.tool)}</p>
                    <p className="text-muted-foreground text-xs">{auth.tool}</p>
                  </div>
                  {auth.url ? (
                    <a
                      className="rounded-md border bg-primary px-3 py-1.5 font-mono text-primary-foreground text-xs uppercase tracking-wide hover:opacity-90"
                      href={auth.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Authorize {toolkitLabel(auth.tool)}
                    </a>
                  ) : (
                    <span className="font-mono text-muted-foreground text-xs uppercase">
                      {auth.status ?? 'unknown'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-3">
          {Object.entries(bySystem).map(([system, count]) => (
            <div key={system} className="rounded-lg border bg-card p-4">
              <p className="font-mono text-muted-foreground text-xs uppercase">{system}</p>
              <p className="mt-2 font-semibold text-2xl">{String(count)}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-xl">Tool calls</h2>
          <div className="grid gap-4">
            {data.toolCalls.map((toolCall) => (
              <ToolCallCard key={toolCall.id} toolCall={toolCall} onChanged={refresh} />
            ))}
          </div>
        </section>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div>
          <p className="font-mono text-muted-foreground text-xs uppercase">Primary artifact</p>
          <h2 className="mt-1 font-semibold text-xl">Co-authorship trace</h2>
        </div>
        <CoAuthorshipTimeline mutations={data.mutations} />
      </aside>
    </main>
  )
}

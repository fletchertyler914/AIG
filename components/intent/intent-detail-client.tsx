'use client'

import { ArrowLeft, CheckCircle2, GitBranch, LayoutGrid, List, Lock } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { IntentCanvas } from '@/components/intent/intent-canvas'
import { IntentCanvasList } from '@/components/intent/intent-canvas-list'
import { IntentSidePanel } from '@/components/intent/intent-side-panel'
import { IntentTraceDrawer } from '@/components/intent/intent-trace-drawer'
import type { IntentWithTraceDto } from '@/components/intent/types'
import { asRecord } from '@/components/intent/types'
import { IntentDisplayBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { canPromoteIntentStatus } from '@/lib/aig/pipeline'
import { intentStatusDisplay } from '@/lib/display/intent-status'
import { formatToolkitDisplayName } from '@/lib/display/toolkits'
import { cn } from '@/lib/utils'

interface IntentDetailClientProps {
  intentId: string
}

interface PendingAuthorization {
  tool: string
  url?: string
  providerId?: string
  status?: string
}

type ViewMode = 'canvas' | 'list'

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

async function fetchIntent(intentId: string): Promise<IntentWithTraceDto> {
  const res = await fetch(`/api/intents/${intentId}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as IntentWithTraceDto
}

export function IntentDetailClient({ intentId }: IntentDetailClientProps) {
  const [data, setData] = useState<IntentWithTraceDto | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('canvas')
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setData(await fetchIntent(intentId))
  }, [intentId])

  useEffect(() => {
    let cancelled = false
    let source: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      if (cancelled) return
      source = new EventSource(`/api/intents/${intentId}/stream`)
      source.addEventListener('intent', (event) => {
        const message = event as MessageEvent<string>
        setData(JSON.parse(message.data) as IntentWithTraceDto)
      })
      source.addEventListener('error', () => {
        source?.close()
        source = null
        if (!cancelled) {
          retryTimer = setTimeout(connect, 2_000)
        }
      })
    }

    void refresh()
    connect()

    return () => {
      cancelled = true
      source?.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [intentId, refresh])

  const approve = () => {
    startTransition(async () => {
      const res = await fetch(`/api/intents/${intentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execute: true }),
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
      <Container width="wide" className="flex flex-1 items-center justify-center py-20">
        <p className="font-mono text-muted-foreground text-sm uppercase tracking-widest">
          Loading intent…
        </p>
      </Container>
    )
  }

  const impact = asRecord(data.intent.impact)
  const bySystem = asRecord(impact['bySystem'])
  const pendingAuths = readPendingAuthorizations(impact)
  const statusDisplay = intentStatusDisplay({
    status: data.intent.status,
    confidence: data.intent.confidence,
    pendingAuthCount: pendingAuths.length,
  })
  const agentSummary = typeof impact['agentSummary'] === 'string' ? impact['agentSummary'] : null
  const canApprove = data.intent.status === 'PENDING_REVIEW' && pendingAuths.length === 0
  const showPromote = canPromoteIntentStatus(data.intent.status)

  const promoteToPipeline = () => {
    startTransition(async () => {
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId }),
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      toast.success('Pipeline saved — open Pipelines to run it again.')
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-14">
      <Container width="wide" className="flex flex-col gap-5 py-5 sm:gap-6 sm:py-6">
        {/* Sticky chrome */}
        <div className="sticky top-16 z-10 -mx-4 border-border border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/app"
                className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back to runs
              </Link>
              <span className="hidden h-4 w-px bg-border sm:inline" aria-hidden />
              <IntentDisplayBadge
                status={data.intent.status}
                confidence={data.intent.confidence}
                impact={data.intent.impact}
                data-testid="intent-status"
              />
              {data.intent.systems.map((system) => (
                <span
                  key={system}
                  className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {formatToolkitDisplayName(system)}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {showPromote ? (
                <Button
                  disabled={isPending}
                  onClick={promoteToPipeline}
                  size="sm"
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                >
                  <GitBranch className="size-3.5" />
                  Save as pipeline
                </Button>
              ) : null}
              <Button
                size="lg"
                variant="display"
                data-testid="approve-button"
                disabled={isPending || !canApprove}
                onClick={approve}
                className="gap-2"
              >
                <CheckCircle2 className="size-4" />
                {data.intent.status === 'PENDING_REVIEW'
                  ? isPending
                    ? 'Approving…'
                    : 'Approve intent'
                  : data.intent.status === 'EXECUTING'
                    ? 'Executing…'
                    : data.intent.status === 'COMPLETE'
                      ? 'Executed'
                      : data.intent.status}
              </Button>
            </div>
          </div>
          {statusDisplay.hint ? (
            <p className="mt-2 text-muted-foreground text-xs">{statusDisplay.hint}</p>
          ) : null}
        </div>

        {/* Title block */}
        <header className="space-y-2">
          <h1
            className="font-mono font-semibold text-2xl uppercase tracking-tight sm:text-3xl"
            data-testid="intent-label"
          >
            {data.intent.label}
          </h1>
          <p className="max-w-3xl text-muted-foreground leading-relaxed">
            {data.intent.description}
          </p>
        </header>

        {/* Locked objective */}
        <Card tone="elevated" className="border-aig-pending/40 bg-aig-pending/[0.04]">
          <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-aig-pending" />
              <p className="font-mono text-[10px] text-aig-pending uppercase tracking-widest">
                Locked objective:
              </p>
            </div>
            <p className="font-medium text-foreground text-sm leading-relaxed">
              {data.intent.objective}
            </p>
          </CardContent>
        </Card>

        {/* Workspace: canvas/list + side panel */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Execution graph
            </p>
            <div className="inline-flex border border-border bg-surface-2 p-0.5">
              <button
                type="button"
                data-testid="view-canvas"
                onClick={() => setViewMode('canvas')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors',
                  viewMode === 'canvas'
                    ? 'bg-background text-foreground shadow-arcade'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutGrid className="size-3.5" />
                Canvas
              </button>
              <button
                type="button"
                data-testid="view-list"
                onClick={() => setViewMode('list')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors',
                  viewMode === 'list'
                    ? 'bg-background text-foreground shadow-arcade'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <List className="size-3.5" />
                List
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
            {viewMode === 'canvas' ? (
              <IntentCanvas
                toolCalls={data.toolCalls}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <IntentCanvasList
                toolCalls={data.toolCalls}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}

            <IntentSidePanel
              toolCalls={data.toolCalls}
              selectedId={selectedId}
              bySystem={bySystem}
              agentSummary={agentSummary}
              pendingAuths={pendingAuths}
              returnTo={`/app/intent/${intentId}`}
              onChanged={refresh}
            />
          </div>
        </section>
      </Container>

      <IntentTraceDrawer mutations={data.mutations} />
    </div>
  )
}

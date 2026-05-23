'use client'

import { ArrowRight, ChevronRight, GitBranch, Inbox, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { PipelineDto } from '@/app/api/pipelines/route'
import type { IntentDto } from '@/components/intent/types'
import { IntentDisplayBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Kbd, SectionHeader } from '@/components/ui/section'
import { formatToolkitDisplayName } from '@/lib/display/toolkits'
import { cn } from '@/lib/utils'

interface ListResponse {
  intents: IntentDto[]
}

interface PipelinesResponse {
  pipelines: PipelineDto[]
}

async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    if (typeof body.error === 'string' && body.error.length > 0) return body.error
  } catch {
    // Fall back to the raw response text below.
  }

  return res.text()
}

async function listIntents(): Promise<IntentDto[]> {
  const res = await fetch('/api/intents', { cache: 'no-store' })
  if (!res.ok) throw new Error(await readApiError(res))
  const body = (await res.json()) as ListResponse
  return body.intents
}

async function listPipelines(): Promise<PipelineDto[]> {
  const res = await fetch('/api/pipelines', { cache: 'no-store' })
  if (!res.ok) throw new Error(await readApiError(res))
  const body = (await res.json()) as PipelinesResponse
  return body.pipelines
}

const PROMPT_PLACEHOLDER =
  'e.g. Follow up with the open Acme and Globex leads — send a short email to each and schedule an intro call next week.'

const EXAMPLE_PROMPTS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: 'Lead follow-up sequence',
    prompt:
      'Follow up with the open Acme and Globex leads — send a short email to each and schedule an intro call next week.',
  },
  {
    label: 'Launch comms + reminder',
    prompt:
      'Email a concise AIG launch update to fletchertyler914@gmail.com and create a 15-minute calendar reminder for tomorrow at 9am.',
  },
  {
    label: 'Design review handoff',
    prompt:
      'Email the design review notes to alice@example.com and add a 30-minute follow-up to my calendar tomorrow.',
  },
]

function formatTimestamp(ms: number): string {
  const now = Date.now()
  const diff = now - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(ms)
}

export function IntentDashboard() {
  const router = useRouter()
  const [intents, setIntents] = useState<IntentDto[]>([])
  const [pipelines, setPipelines] = useState<PipelineDto[]>([])
  const [prompt, setPrompt] = useState('')
  const [pendingPipelineId, setPendingPipelineId] = useState<string | null>(null)
  const [isPlanning, startPlanning] = useTransition()
  const [isRunningDemo, startDemo] = useTransition()

  useEffect(() => {
    void listIntents()
      .then(setIntents)
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load intents')
      })
    void listPipelines()
      .then(setPipelines)
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load pipelines')
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
        toast.error(await readApiError(res))
        return
      }
      const body = (await res.json()) as { intentId: string }
      router.push(`/app/intent/${body.intentId}`)
    })
  }

  const runDemo = () => {
    startDemo(async () => {
      const res = await fetch('/api/intents/demo', { method: 'POST' })
      if (!res.ok) {
        toast.error(await readApiError(res))
        return
      }
      const body = (await res.json()) as { intentId: string }
      router.push(`/app/intent/${body.intentId}`)
    })
  }

  const runPipeline = (pipelineId: string) => {
    setPendingPipelineId(pipelineId)
    startPlanning(async () => {
      const res = await fetch(`/api/pipelines/${encodeURIComponent(pipelineId)}/run`, {
        method: 'POST',
      })
      if (!res.ok) {
        toast.error(await readApiError(res))
        setPendingPipelineId(null)
        return
      }
      const body = (await res.json()) as { intentId: string }
      router.push(`/app/intent/${body.intentId}`)
    })
  }

  const busy = isPlanning || isRunningDemo || pendingPipelineId !== null

  return (
    <Container width="page" className="flex flex-col gap-8 py-8 sm:py-10">
      <PageHeader
        eyebrow="Runs"
        title="Plan a multi-tool intent"
        description="Claude reasons over your authorized Arcade toolkits, captures the plan without executing it, and AIG forms a transactional intent you can review and approve."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={runDemo}
            data-testid="run-demo"
            className="gap-2"
          >
            <PlayCircle className="size-4" />
            {isRunningDemo ? 'Loading…' : 'Replay locked demo'}
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-5 pt-6 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="font-mono text-primary text-sm tracking-widest" aria-hidden>
              ▮▮▮
            </span>
            <p className="font-medium text-sm">New intent</p>
          </div>

          <Textarea
            className="min-h-[128px] font-mono text-sm"
            data-testid="plan-prompt"
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

          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example.label}
                type="button"
                data-testid="example-prompt"
                disabled={busy}
                onClick={() => setPrompt(example.prompt)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1 text-muted-foreground text-xs transition-colors',
                  'hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <span className="font-mono text-primary">↳</span>
                {example.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-stretch gap-3 border-border border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs">
              Press <Kbd>⌘</Kbd>
              <span className="mx-1">+</span>
              <Kbd>Enter</Kbd> to plan.
            </p>
            <Button
              className="gap-2 sm:ml-auto"
              data-testid="run-plan"
              disabled={busy}
              onClick={runPlan}
            >
              {isPlanning ? 'Planning…' : 'Run plan'}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {pipelines.length > 0 ? (
        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4 text-primary" />
                  <p className="font-medium text-sm">Start from pipeline</p>
                </div>
                <p className="text-muted-foreground text-sm">
                  Launch a new review run from a saved template.
                </p>
              </div>
              <Link
                href="/app/pipelines"
                className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
              >
                View all
                <ChevronRight className="size-3" />
              </Link>
            </div>

            <div className="grid gap-2">
              {pipelines.slice(0, 3).map((pipeline) => (
                <div
                  key={pipeline.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-1/30 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-sm">{pipeline.name}</p>
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">
                        v{pipeline.version}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {pipeline.toolCount} tools ·{' '}
                      {pipeline.systems.map(formatToolkitDisplayName).join(', ')}
                    </p>
                  </div>
                  <Button
                    disabled={busy}
                    onClick={() => runPipeline(pipeline.id)}
                    size="sm"
                    variant="secondary"
                  >
                    <PlayCircle className="size-3.5" />
                    {pendingPipelineId === pipeline.id ? 'Starting…' : 'Run'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title="Recent intents"
          description="Intents in this workspace, newest first."
        />
        {intents.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No intents yet"
            description="Plan one above, or replay the locked demo to see the loop end-to-end."
          />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {intents.map((intent) => (
                <li key={intent.id}>
                  <Link
                    href={`/app/intent/${intent.id}`}
                    className="flex items-center gap-4 border-transparent border-l-2 px-5 py-4 transition-colors hover:border-primary hover:bg-surface-2 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium text-foreground text-sm">
                          {intent.label}
                        </h3>
                        <IntentDisplayBadge
                          status={intent.status}
                          confidence={intent.confidence}
                          impact={intent.impact}
                        />
                      </div>
                      <p className="mt-1 line-clamp-1 text-muted-foreground text-sm">
                        {intent.description}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatTimestamp(intent.createdAt)}
                        {intent.systems.length > 0
                          ? ` · ${intent.systems.map(formatToolkitDisplayName).join(' · ')}`
                          : ''}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </Container>
  )
}

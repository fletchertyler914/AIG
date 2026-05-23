'use client'

import { ArrowRight, ChevronRight, Inbox, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
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

async function listIntents(): Promise<IntentDto[]> {
  const res = await fetch('/api/intents', { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  const body = (await res.json()) as ListResponse
  return body.intents
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
      router.push(`/app/intent/${body.intentId}`)
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
      router.push(`/app/intent/${body.intentId}`)
    })
  }

  const busy = isPlanning || isRunningDemo

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

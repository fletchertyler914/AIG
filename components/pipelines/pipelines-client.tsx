'use client'

import { GitBranch, PlayCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { PipelineDto } from '@/app/api/pipelines/route'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { formatToolkitDisplayName } from '@/lib/display/toolkits'
import { cn } from '@/lib/utils'

interface PipelinesResponse {
  workspace: { id: string; name: string }
  pipelines: PipelineDto[]
}

async function fetchPipelines(): Promise<PipelinesResponse> {
  const res = await fetch('/api/pipelines', { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as PipelinesResponse
}

export function PipelinesClient() {
  const router = useRouter()
  const [data, setData] = useState<PipelinesResponse | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isRefreshing, startRefresh] = useTransition()

  const load = useCallback(() => {
    startRefresh(async () => {
      try {
        setData(await fetchPipelines())
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load pipelines')
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const runPipeline = async (pipelineId: string) => {
    setPendingId(pipelineId)
    try {
      const res = await fetch(`/api/pipelines/${encodeURIComponent(pipelineId)}/run`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(await res.text())
      const body = (await res.json()) as { intentId: string }
      router.push(`/app/intent/${body.intentId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run pipeline')
    } finally {
      setPendingId(null)
    }
  }

  const pipelines = data?.pipelines ?? []

  return (
    <Container width="page" className="flex flex-col gap-6 py-8 sm:py-10">
      <PageHeader
        eyebrow="Pipelines"
        title="Reusable run templates"
        description="Promote a reviewed or completed run into a versioned pipeline, then launch new intents with the same objective and tool graph."
        actions={
          <Button disabled={isRefreshing} onClick={load} size="sm" variant="secondary">
            <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {pipelines.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No pipelines yet"
          description="Open a completed or review-ready run and click Save as pipeline on the intent page."
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} href="/app">
              Browse runs
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-base tracking-tight">{pipeline.name}</h2>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">
                      v{pipeline.version}
                    </span>
                  </div>
                  {pipeline.description ? (
                    <p className="text-muted-foreground text-sm">{pipeline.description}</p>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    {pipeline.toolCount} tools ·{' '}
                    {pipeline.systems.map(formatToolkitDisplayName).join(', ')}
                  </p>
                  <p className="line-clamp-2 text-foreground/80 text-xs">{pipeline.objective}</p>
                </div>
                <Button
                  className="shrink-0 gap-2"
                  disabled={pendingId === pipeline.id}
                  onClick={() => void runPipeline(pipeline.id)}
                  size="sm"
                >
                  <PlayCircle className="size-4" />
                  {pendingId === pipeline.id ? 'Starting…' : 'Run pipeline'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Container>
  )
}

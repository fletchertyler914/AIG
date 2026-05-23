'use client'

import { Activity, GitBranch, Link2, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { IntentDisplayBadge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/ui/page-header'
import { formatToolkitDisplayName } from '@/lib/display/toolkits'

interface InsightsResponse {
  workspace: { id: string; name: string; kind: string }
  insights: {
    intentsByStatus: Record<string, number>
    totalIntents: number
    pipelineCount: number
    connectedToolkits: number
    enabledToolkits: number
  }
  recentIntents: Array<{
    id: string
    label: string
    status: string
    createdAt: number
    systems: string[]
  }>
}

export function InsightsClient() {
  const [data, setData] = useState<InsightsResponse | null>(null)

  useEffect(() => {
    void fetch('/api/insights', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return (await res.json()) as InsightsResponse
      })
      .then(setData)
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load insights')
      })
  }, [])

  const insights = data?.insights

  return (
    <Container width="page" className="flex flex-col gap-8 py-8 sm:py-10">
      <PageHeader
        eyebrow="Insights"
        title="Workspace activity"
        description="Run volume, connection health, and pipeline coverage for this workspace."
      />

      {!insights ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={PlayCircle} label="Total runs" value={String(insights.totalIntents)} />
            <StatCard icon={GitBranch} label="Pipelines" value={String(insights.pipelineCount)} />
            <StatCard
              icon={Link2}
              label="Connected toolkits"
              value={String(insights.connectedToolkits)}
            />
            <StatCard
              icon={Activity}
              label="Enabled for planning"
              value={String(insights.enabledToolkits)}
            />
          </div>

          <Card>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <h2 className="font-medium text-sm">Runs by status</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(insights.intentsByStatus)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([status, count]) => (
                    <li
                      key={status}
                      className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
                    >
                      <IntentDisplayBadge status={status} />
                      <span className="font-mono tabular-nums">{count}</span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>

          {data.recentIntents.length > 0 ? (
            <Card>
              <CardContent className="space-y-3 p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-sm">Recent runs</h2>
                  <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href="/app">
                    View all
                  </Link>
                </div>
                <ul className="divide-y divide-border">
                  {data.recentIntents.map((intent) => (
                    <li key={intent.id}>
                      <Link
                        className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                        href={`/app/intent/${intent.id}`}
                      >
                        <span className="truncate font-medium">{intent.label}</span>
                        <span className="shrink-0 text-muted-foreground text-xs">
                          {intent.systems.map(formatToolkitDisplayName).join(', ')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </Container>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-9 items-center justify-center rounded-md border border-border bg-surface-2">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            {label}
          </p>
          <p className="font-semibold text-2xl tabular-nums tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

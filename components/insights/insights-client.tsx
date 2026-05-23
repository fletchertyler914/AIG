'use client'

import {
  Activity,
  Download,
  GitBranch,
  Link2,
  Loader2,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { IntentDisplayBadge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/ui/page-header'
import { ToolCombobox } from '@/components/ui/tool-combobox'
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

interface PolicyDecisionAuditResponse {
  decisions: PolicyDecisionAuditRow[]
}

interface PolicyDecisionAuditRow {
  id: string
  intentId: string
  intentLabel: string
  intentStatus: string
  approverEmail: string | null
  approverRole: string | null
  decision: 'allowed' | 'blocked'
  reason: string | null
  matchedRules: Array<{
    policyId: string
    policyName: string
    tool: string
    action: string
  }>
  createdAt: number
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
        <InsightsLoadingState />
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

          <PolicyAuditPanel />
        </>
      )}
    </Container>
  )
}

function InsightsLoadingState() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {['Total runs', 'Pipelines', 'Connected toolkits', 'Enabled for planning'].map((label) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">{label}</p>
              <div className="h-5 w-14 rounded bg-surface-2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PolicyAuditPanel() {
  const [decision, setDecision] = useState<'all' | 'allowed' | 'blocked'>('all')
  const [tool, setTool] = useState('')
  const [actor, setActor] = useState('')
  const [rows, setRows] = useState<PolicyDecisionAuditRow[]>([])
  const [loading, setLoading] = useState(true)

  const params = useMemo(() => {
    const search = new URLSearchParams({ limit: '25' })
    if (decision !== 'all') search.set('decision', decision)
    if (tool.trim()) search.set('tool', tool.trim())
    if (actor.trim()) search.set('actor', actor.trim())
    return search
  }, [actor, decision, tool])

  const exportHref = useMemo(() => {
    const search = new URLSearchParams(params)
    search.set('format', 'csv')
    return `/api/audit/policy-decisions?${search.toString()}`
  }, [params])

  const load = useCallback(() => {
    setLoading(true)
    void fetch(`/api/audit/policy-decisions?${params.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return (await res.json()) as PolicyDecisionAuditResponse
      })
      .then((body) => setRows(body.decisions))
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load policy audit')
      })
      .finally(() => setLoading(false))
  }, [params])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="font-medium text-sm">Policy decision audit</h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Filter and export approval-policy decisions, including blocked attempts.
            </p>
          </div>
          <a className={buttonVariants({ variant: 'secondary', size: 'sm' })} href={exportHref}>
            <Download className="size-3.5" />
            Export CSV
          </a>
        </div>

        <div className="grid gap-3 rounded-md border border-border bg-surface-1/40 p-3 sm:grid-cols-[140px_1fr_1fr_auto]">
          <label className="space-y-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Decision
            </span>
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value as typeof decision)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
            >
              <option value="all">All</option>
              <option value="allowed">Allowed</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <div className="space-y-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Tool
            </span>
            <ToolCombobox mode="toolkit" value={tool} onChange={setTool} placeholder="Gmail" />
          </div>
          <label className="space-y-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Actor
            </span>
            <input
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              placeholder="operator@example.com"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
            />
          </label>
          <div className="flex items-end">
            <Button onClick={load} size="sm" variant="secondary" className="w-full">
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading audit…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-border border-dashed p-4 text-muted-foreground text-sm">
            No policy decisions match these filters yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/app/intent/${row.intentId}`}
                    className="font-medium text-sm transition-colors hover:text-primary"
                  >
                    {row.intentLabel}
                  </Link>
                  <span
                    className={
                      row.decision === 'blocked'
                        ? 'font-mono text-[10px] text-destructive uppercase tracking-widest'
                        : 'font-mono text-[10px] text-success uppercase tracking-widest'
                    }
                  >
                    {row.decision}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {new Date(row.createdAt).toLocaleString()} · {row.approverEmail ?? 'unknown'} ·{' '}
                  {row.approverRole ?? 'unknown role'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {row.matchedRules
                    .map((rule) => `${rule.policyName} matched ${rule.tool}`)
                    .join('; ')}
                </p>
                {row.reason ? <p className="text-destructive text-xs">{row.reason}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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

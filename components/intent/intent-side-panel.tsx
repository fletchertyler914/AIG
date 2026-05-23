'use client'

import { ExternalLink, Plus, ShieldAlert } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ToolCallArgsEditor } from '@/components/intent/tool-call-args-editor'
import type { ToolCallDto } from '@/components/intent/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  formatToolActionTitle,
  formatToolDisplayName,
  formatToolkitDisplayName,
  formatToolMetaLine,
  parseArcadeTool,
} from '@/lib/display/toolkits'

interface PendingAuthorization {
  tool: string
  url?: string
  providerId?: string
  status?: string
}

interface IntentSidePanelProps {
  toolCalls: ToolCallDto[]
  selectedId: string | null
  bySystem: Record<string, unknown>
  agentSummary: string | null
  pendingAuths: PendingAuthorization[]
  /** Where to send the user after OAuth completes (e.g. this intent page). */
  returnTo: string
  onChanged: () => Promise<void>
}

export function IntentSidePanel({
  toolCalls,
  selectedId,
  bySystem,
  agentSummary,
  pendingAuths,
  returnTo,
  onChanged,
}: IntentSidePanelProps) {
  const selected = toolCalls.find((tc) => tc.id === selectedId) ?? null
  const [tab, setTab] = useState<'overview' | 'details' | 'add'>(selected ? 'details' : 'overview')
  const byId = new Map(toolCalls.map((tc) => [tc.id, tc]))
  const awaitingAuthRef = useRef(false)

  useEffect(() => {
    if (selected) setTab('details')
  }, [selected])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && awaitingAuthRef.current) {
        awaitingAuthRef.current = false
        void onChanged()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [onChanged])

  return (
    <Card className="flex h-full min-h-[320px] flex-col overflow-hidden">
      <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'overview' | 'details' | 'add')}
          className="flex flex-1 flex-col gap-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="add">Add action</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 space-y-4 overflow-auto">
            {Object.keys(bySystem).length > 0 ? (
              <section aria-label="Impact by system">
                <p className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Impact by system
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(bySystem).map(([system, count]) => (
                    <div
                      key={system}
                      className="rounded-md border border-border bg-surface-2 px-3 py-2 shadow-arcade"
                    >
                      <p className="text-[11px] text-muted-foreground">
                        {formatToolkitDisplayName(system)}
                      </p>
                      <p className="mt-1 font-semibold text-2xl">{String(count)}</p>
                      <p className="text-muted-foreground text-xs">
                        {Number(count) === 1 ? 'tool call' : 'tool calls'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {agentSummary ? (
              <section>
                <p className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Agent summary
                </p>
                <p className="text-sm leading-relaxed">{agentSummary}</p>
              </section>
            ) : null}

            {pendingAuths.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div>
                    <p className="font-mono text-[10px] text-warning uppercase tracking-widest">
                      Authorization required
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                      Complete the OAuth flows below — the page updates automatically when
                      connected.
                    </p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {pendingAuths.map((auth) => (
                    <li
                      key={auth.tool}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-1 p-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-xs">{formatToolDisplayName(auth.tool)}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {formatToolActionTitle(auth.tool)}
                        </p>
                      </div>
                      {auth.url || auth.status === 'pending' ? (
                        <IntentAuthorizeButton
                          returnTo={returnTo}
                          tool={auth.tool}
                          onOAuthOpened={() => {
                            awaitingAuthRef.current = true
                          }}
                        />
                      ) : (
                        <span className="font-mono text-[10px] text-muted-foreground uppercase">
                          {auth.status ?? 'unknown'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {!agentSummary && Object.keys(bySystem).length === 0 && pendingAuths.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Select a node in the graph to inspect tool args and edit actions.
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="details" className="flex-1 overflow-auto">
            {selected ? (
              <div className="space-y-4">
                <div>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                    Selected action
                  </p>
                  <h3 className="mt-1 font-semibold text-sm" data-testid="tool-call-name">
                    {formatToolActionTitle(selected.tool)}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatToolMetaLine(selected.tool, { version: true })}
                  </p>
                  <p className="mt-2 text-muted-foreground text-xs">
                    {selected.dependsOn.length > 0 ? (
                      <>
                        After{' '}
                        {selected.dependsOn
                          .map((dep) => {
                            const depCall = byId.get(dep)
                            return depCall ? formatToolActionTitle(depCall.tool) : dep
                          })
                          .join(', ')}
                      </>
                    ) : (
                      'No dependencies'
                    )}
                  </p>
                </div>
                <ToolCallArgsEditor toolCall={selected} onChanged={onChanged} compact />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  No selection
                </p>
                <p className="mt-2 max-w-xs text-muted-foreground text-sm">
                  Click a node in the graph or list view to inspect and edit its args.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setTab('overview')}
                >
                  Back to overview
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="add" className="flex-1 overflow-auto">
            <AddActionForm
              toolCalls={toolCalls}
              selected={selected}
              onChanged={onChanged}
              onDone={() => setTab('details')}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function AddActionForm({
  toolCalls,
  selected,
  onChanged,
  onDone,
}: {
  toolCalls: ToolCallDto[]
  selected: ToolCallDto | null
  onChanged: () => Promise<void>
  onDone: () => void
}) {
  const [tool, setTool] = useState('')
  const [argsJson, setArgsJson] = useState('{\n  \n}')
  const [afterToolCallId, setAfterToolCallId] = useState(selected?.id ?? '')
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (selected) setAfterToolCallId(selected.id)
  }, [selected])

  const addAction = () => {
    const trimmedTool = tool.trim()
    if (!trimmedTool) {
      toast.error('Enter an Arcade tool name first.')
      return
    }

    let args: Record<string, unknown>
    try {
      const parsed = JSON.parse(argsJson) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        toast.error('Args must be a JSON object.')
        return
      }
      args = parsed as Record<string, unknown>
    } catch {
      toast.error('Args must be valid JSON.')
      return
    }

    startTransition(async () => {
      const res = await fetch(`/api/intents/${toolCalls[0]?.intentId ?? ''}/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'add',
          tool: trimmedTool,
          args,
          ...(afterToolCallId ? { afterToolCallId } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      toast.success('Action added — downstream graph repaired.')
      setTool('')
      setArgsJson('{\n  \n}')
      setReason('')
      await onChanged()
      onDone()
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          Add action
        </p>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          Insert a new Arcade tool call. If you anchor it after an existing action, AIG repairs
          downstream dependents so the graph accounts for the addition.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          Tool
        </span>
        <input
          className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus:border-ring"
          disabled={pending}
          onChange={(event) => setTool(event.target.value)}
          placeholder="Gmail.SendEmail@7.0.0"
          value={tool}
        />
      </label>

      <label className="block space-y-1">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          After
        </span>
        <select
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
          disabled={pending}
          onChange={(event) => setAfterToolCallId(event.target.value)}
          value={afterToolCallId}
        >
          <option value="">No dependency</option>
          {toolCalls.map((toolCall) => (
            <option key={toolCall.id} value={toolCall.id}>
              {formatToolActionTitle(toolCall.tool)}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          Args JSON
        </span>
        <textarea
          className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring"
          disabled={pending}
          onChange={(event) => setArgsJson(event.target.value)}
          value={argsJson}
        />
      </label>

      <label className="block space-y-1">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          Reason
        </span>
        <input
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
          disabled={pending}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Notify the owner before the customer email"
          value={reason}
        />
      </label>

      <Button disabled={pending || toolCalls.length === 0} onClick={addAction} className="w-full">
        <Plus className="size-4" />
        {pending ? 'Adding…' : 'Add and replan'}
      </Button>
    </div>
  )
}

function IntentAuthorizeButton({
  tool,
  returnTo,
  onOAuthOpened,
}: {
  tool: string
  returnTo: string
  onOAuthOpened: () => void
}) {
  const [pending, setPending] = useState(false)
  const toolkitName = parseArcadeTool(tool).toolkit

  const authorize = async () => {
    setPending(true)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkitName, scope: 'personal', returnTo }),
      })
      if (!res.ok) throw new Error(await res.text())
      const body = (await res.json()) as { connection: { authUrl: string | null } }
      if (body.connection.authUrl) {
        onOAuthOpened()
        // Open without `noopener` so we can detect popup blockers (with noopener
        // window.open() returns null per spec). Sever the opener manually.
        const opened = window.open(body.connection.authUrl, '_blank')
        if (!opened) {
          window.location.href = body.connection.authUrl
          return
        }
        try {
          opened.opener = null
        } catch {
          /* cross-origin — best effort */
        }
        toast(`Authorize ${formatToolkitDisplayName(toolkitName)} in the new tab`, {
          description: 'This intent will update automatically when you return.',
        })
        return
      }
      toast.success(`${formatToolkitDisplayName(toolkitName)} connected`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to authorize ${formatToolkitDisplayName(toolkitName)}`,
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      className="gap-1.5"
      disabled={pending}
      onClick={() => void authorize()}
      size="sm"
      type="button"
      variant="primary"
    >
      {pending ? 'Starting…' : 'Authorize'}
      {!pending ? <ExternalLink className="size-3" /> : null}
    </Button>
  )
}

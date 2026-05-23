'use client'

import { Lock, Plug, RefreshCw, Search, ShieldAlert, Unplug, User, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ConnectionDto, ConnectionScope } from '@/app/api/connections/route'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  formatAuthProviderName,
  inferProviderIdFromToolkit,
  isProviderConfigured,
} from '@/lib/display/auth-providers'
import { formatToolkitDisplayName } from '@/lib/display/toolkits'
import { cn } from '@/lib/utils'

interface ConnectionsResponse {
  workspace: { id: string; name: string; kind: string }
  verifierMode: 'arcade' | 'custom'
  sharedConnectionsSupported: boolean
  canManageShared: boolean
  configuredProviderIds: string[]
  catalogFetchedAt: number | null
  indexTotal: number | null
  searchQuery: string | null
  personal: ConnectionDto[]
  shared: ConnectionDto[]
}

interface MergedToolkit {
  toolkitName: string
  description: string | null
  categories: string[]
  toolCount: number
  personal?: ConnectionDto
  shared?: ConnectionDto
}

async function fetchConnections(refresh = false, query = ''): Promise<ConnectionsResponse> {
  const params = new URLSearchParams()
  if (refresh) params.set('refresh', '1')
  const trimmed = query.trim()
  if (trimmed) params.set('q', trimmed)
  const qs = params.toString()
  const res = await fetch(`/api/connections${qs ? `?${qs}` : ''}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as ConnectionsResponse
}

export function ConnectionsClient() {
  const [data, setData] = useState<ConnectionsResponse | null>(null)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [isRefreshing, startRefresh] = useTransition()
  const [isSearching, startSearch] = useTransition()
  const debouncedQuery = useDebouncedValue(query, 300)

  const loadCatalog = useCallback((refresh: boolean, search: string) => {
    const run = refresh ? startRefresh : startSearch
    run(async () => {
      try {
        setData(await fetchConnections(refresh, search))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load connections')
      }
    })
  }, [])

  useEffect(() => {
    loadCatalog(false, debouncedQuery.trim())
  }, [debouncedQuery, loadCatalog])

  const mergedToolkits = useMemo(() => mergeToolkits(data), [data])

  const categories = useMemo(() => {
    const values = new Set<string>(['All', 'Enabled', 'Connected'])
    for (const toolkit of mergedToolkits) {
      for (const category of toolkit.categories) values.add(category)
    }
    return Array.from(values)
  }, [mergedToolkits])

  const filtered = useMemo(() => {
    return mergedToolkits.filter((toolkit) => {
      const personal = toolkit.personal
      const shared = toolkit.shared
      const anyEnabled = personal?.enabled || shared?.enabled
      const anyConnected =
        personal?.authStatus === 'completed' || shared?.authStatus === 'completed'

      const matchesCategory =
        activeCategory === 'All' ||
        (activeCategory === 'Enabled' && anyEnabled) ||
        (activeCategory === 'Connected' && anyConnected) ||
        toolkit.categories.includes(activeCategory)

      return matchesCategory
    })
  }, [activeCategory, mergedToolkits])

  const stats = useMemo(() => {
    const searching = query.trim().length > 0
    return {
      total: mergedToolkits.length,
      indexTotal: data?.indexTotal ?? null,
      searching,
      connectedPersonal: (data?.personal ?? []).filter((c) => c.authStatus === 'completed').length,
      connectedShared: (data?.shared ?? []).filter((c) => c.authStatus === 'completed').length,
    }
  }, [data, mergedToolkits.length, query])

  const awaitingAuthRef = useRef(false)

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && awaitingAuthRef.current) {
        awaitingAuthRef.current = false
        loadCatalog(true, debouncedQuery.trim())
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [debouncedQuery, loadCatalog])

  const connect = async (toolkitName: string, scope: ConnectionScope) => {
    const key = `${scope}:${toolkitName}`
    setPendingKey(key)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkitName, scope }),
      })
      if (!res.ok) throw new Error(await res.text())
      const body = (await res.json()) as { connection: ConnectionDto }
      if (body.connection.authUrl) {
        awaitingAuthRef.current = true
        // Note: `noopener` makes window.open() return null, defeating popup-blocker
        // detection. Open without it, then sever the opener manually.
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
          description: 'We will refresh this page when you return.',
        })
        return
      }
      const providerLabel = body.connection.providerId
        ? formatAuthProviderName(body.connection.providerId)
        : null
      toast.success(`${formatToolkitDisplayName(toolkitName)} connected`, {
        description: providerLabel
          ? `Scopes covered by your existing ${providerLabel} grant — no new OAuth needed.`
          : 'Scopes already covered by an existing grant — no new OAuth needed.',
      })
      loadCatalog(true, debouncedQuery.trim())
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to connect ${formatToolkitDisplayName(toolkitName)}`,
      )
    } finally {
      setPendingKey(null)
    }
  }

  const toggle = async (toolkitName: string, scope: ConnectionScope, enabled: boolean) => {
    const key = `${scope}:${toolkitName}`
    setPendingKey(key)
    try {
      const res = await fetch(`/api/connections/${encodeURIComponent(toolkitName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, scope }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success(
        `${formatToolkitDisplayName(toolkitName)} ${enabled ? 'enabled' : 'disabled'} for planning`,
      )
      loadCatalog(false, debouncedQuery.trim())
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to update ${formatToolkitDisplayName(toolkitName)}`,
      )
    } finally {
      setPendingKey(null)
    }
  }

  const [removeTarget, setRemoveTarget] = useState<{
    toolkitName: string
    scope: ConnectionScope
  } | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const requestRemove = (toolkitName: string, scope: ConnectionScope) => {
    setRemoveTarget({ toolkitName, scope })
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    const { toolkitName, scope } = removeTarget
    const key = `${scope}:${toolkitName}`
    setIsRemoving(true)
    setPendingKey(key)
    try {
      const res = await fetch(
        `/api/connections/${encodeURIComponent(toolkitName)}?scope=${scope}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error(await res.text())
      const body = (await res.json()) as {
        revoked: boolean
        providerId?: string | null
        reauthorizeUrl?: string | null
        reauthorizeToolkits?: string[]
      }
      if (body.reauthorizeUrl) {
        awaitingAuthRef.current = true
        const opened = window.open(body.reauthorizeUrl, '_blank')
        if (!opened) {
          window.location.href = body.reauthorizeUrl
          return
        }
        try {
          opened.opener = null
        } catch {
          /* cross-origin — best effort */
        }
      }

      const reauthCount = body.reauthorizeToolkits?.length ?? 0
      toast.success(`${formatToolkitDisplayName(toolkitName)} disconnected`, {
        description: body.reauthorizeUrl
          ? `Re-authorize ${reauthCount} remaining toolkit${reauthCount === 1 ? '' : 's'} in the new tab to keep their access.`
          : body.revoked
            ? 'Removed this toolkit and rebuilt the remaining provider grant.'
            : 'No active Arcade grant to revoke.',
      })
      loadCatalog(true, debouncedQuery.trim())
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to disconnect ${formatToolkitDisplayName(toolkitName)}`,
      )
    } finally {
      setIsRemoving(false)
      setPendingKey(null)
      setRemoveTarget(null)
    }
  }

  return (
    <Container width="wide" className="flex flex-col gap-4 py-6 sm:py-8">
      <PageHeader
        eyebrow="Connections"
        title="Arcade toolkits"
        description={
          <>
            Authorize toolkits for yourself or for{' '}
            <strong className="text-foreground">{data?.workspace.name ?? 'this workspace'}</strong>.
            Enabled toolkits become available to the plan agent.
          </>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={isRefreshing || isSearching}
            onClick={() => loadCatalog(true, debouncedQuery.trim())}
            className="gap-2"
          >
            <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {data?.verifierMode === 'arcade' ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Local dev mode.</strong> Arcade user verifier is
            active — sign into{' '}
            <a
              className="text-primary hover:underline"
              href="https://app.arcade.dev"
              rel="noreferrer"
              target="_blank"
            >
              arcade.dev
            </a>{' '}
            with the same email you use in AIG. Workspace-scoped connections require production
            custom verifier mode.
          </p>
        </div>
      ) : null}

      <p className="-mt-2 text-muted-foreground text-sm tabular-nums">
        {stats.searching ? (
          <>
            {stats.total} match{stats.total === 1 ? '' : 'es'}
            {stats.indexTotal !== null ? (
              <>
                <span className="text-muted-foreground/50"> · </span>
                searched {stats.indexTotal} toolkits
              </>
            ) : null}
            {isSearching ? (
              <>
                <span className="text-muted-foreground/50"> · </span>
                searching…
              </>
            ) : null}
          </>
        ) : (
          <>
            {stats.total} available
            <span className="text-muted-foreground/50"> · </span>
            {stats.connectedPersonal} personal OAuth
            <span className="text-muted-foreground/50"> · </span>
            {stats.connectedShared} workspace OAuth
          </>
        )}
      </p>

      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search toolkits…"
              className="h-9 border-transparent bg-surface-2 pl-9 shadow-none focus-visible:border-border"
            />
          </div>
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
                  activeCategory === category
                    ? 'border-primary bg-primary text-primary-foreground shadow-arcade'
                    : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={query.trim() ? 'No toolkits match your search' : 'No toolkits match your filter'}
          description={
            query.trim()
              ? 'Try a different query — search runs against every Arcade toolkit.'
              : 'Try a different category, or clear the search.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-border border-b bg-surface-2/30 text-left">
                  <th className="px-4 py-2 font-medium text-muted-foreground text-xs">Toolkit</th>
                  <th className="w-16 px-2 py-2 text-center font-medium text-muted-foreground text-xs">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <User className="size-3" aria-hidden />
                      <span className="sr-only sm:not-sr-only">You</span>
                    </span>
                  </th>
                  <th className="w-16 px-2 py-2 text-center font-medium text-muted-foreground text-xs">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Users className="size-3" aria-hidden />
                      <span className="sr-only sm:not-sr-only">Workspace</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((toolkit) => (
                  <ToolkitTableRow
                    canManageShared={
                      (data?.canManageShared ?? false) &&
                      (data?.sharedConnectionsSupported ?? false)
                    }
                    configuredProviderIds={data?.configuredProviderIds ?? []}
                    key={toolkit.toolkitName}
                    pendingKey={pendingKey}
                    toolkit={toolkit}
                    onConnect={connect}
                    onDisconnect={requestRemove}
                    onToggle={toggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <RemoveToolkitDialog
        target={removeTarget}
        pending={isRemoving}
        onCancel={() => {
          if (!isRemoving) setRemoveTarget(null)
        }}
        onConfirm={() => void confirmRemove()}
      />
    </Container>
  )
}

function RemoveToolkitDialog({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: { toolkitName: string; scope: ConnectionScope } | null
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const toolkitLabel = target ? formatToolkitDisplayName(target.toolkitName) : ''
  const providerLabel = target
    ? formatAuthProviderName(inferProviderIdFromToolkit(target.toolkitName) ?? target.toolkitName)
    : ''

  return (
    <Dialog open={target !== null} onOpenChange={(open) => (!open ? onCancel() : null)}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Remove {toolkitLabel} access?</DialogTitle>
          <DialogDescription>
            OAuth cannot subtract a single scope from an existing {providerLabel} token. AIG will
            revoke the {providerLabel} grant, remove {toolkitLabel}, then re-open OAuth so other{' '}
            {providerLabel} toolkits keep their access.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" size="sm" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" disabled={pending} onClick={onConfirm}>
            {pending ? 'Removing…' : `Remove ${toolkitLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const delay = typeof value === 'string' && value.trim().length === 0 ? 0 : delayMs
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return debounced
}

function mergeToolkits(data: ConnectionsResponse | null): MergedToolkit[] {
  if (!data) return []

  const byName = new Map<string, MergedToolkit>()

  for (const row of data.personal) {
    const existing = byName.get(row.toolkitName)
    if (existing) {
      existing.personal = row
    } else {
      byName.set(row.toolkitName, {
        toolkitName: row.toolkitName,
        description: row.toolkitDescription,
        categories: row.categories,
        toolCount: row.toolCount,
        personal: row,
      })
    }
  }

  for (const row of data.shared) {
    const existing = byName.get(row.toolkitName)
    if (existing) {
      existing.shared = row
    } else {
      byName.set(row.toolkitName, {
        toolkitName: row.toolkitName,
        description: row.toolkitDescription,
        categories: row.categories,
        toolCount: row.toolCount,
        shared: row,
      })
    }
  }

  return Array.from(byName.values()).sort((a, b) =>
    formatToolkitDisplayName(a.toolkitName).localeCompare(formatToolkitDisplayName(b.toolkitName)),
  )
}

function ToolkitTableRow({
  toolkit,
  pendingKey,
  canManageShared,
  configuredProviderIds,
  onConnect,
  onDisconnect,
  onToggle,
}: {
  toolkit: MergedToolkit
  pendingKey: string | null
  canManageShared: boolean
  configuredProviderIds: string[]
  onConnect: (toolkitName: string, scope: ConnectionScope) => void
  onDisconnect: (toolkitName: string, scope: ConnectionScope) => void
  onToggle: (toolkitName: string, scope: ConnectionScope, enabled: boolean) => void
}) {
  const providerId = inferProviderIdFromToolkit(toolkit.toolkitName)
  const providerReady = isProviderConfigured(providerId, configuredProviderIds)

  return (
    <tr className="border-border border-b transition-colors last:border-0 hover:bg-surface-2/20">
      <td className="px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <ToolkitAvatar name={toolkit.toolkitName} />
          <div className="min-w-0">
            <p className="truncate font-medium text-sm tracking-tight">
              {formatToolkitDisplayName(toolkit.toolkitName)}
            </p>
            <p className="truncate text-muted-foreground text-xs">
              {[toolkit.categories[0], `${toolkit.toolCount} tools`].filter(Boolean).join(' · ')}
            </p>
            {providerId && !providerReady ? (
              <p className="mt-0.5 truncate text-[11px] text-warning">
                {formatAuthProviderName(providerId)} OAuth not configured — add in Settings
              </p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5">
        <ScopeCell
          {...(toolkit.personal ? { connection: toolkit.personal } : {})}
          disabled={pendingKey === `personal:${toolkit.toolkitName}`}
          canManage
          onConnect={() => onConnect(toolkit.toolkitName, 'personal')}
          onDisconnect={() => onDisconnect(toolkit.toolkitName, 'personal')}
          onToggle={(enabled) => onToggle(toolkit.toolkitName, 'personal', enabled)}
        />
      </td>
      <td className="px-2 py-1.5">
        <ScopeCell
          {...(toolkit.shared ? { connection: toolkit.shared } : {})}
          disabled={pendingKey === `shared:${toolkit.toolkitName}`}
          canManage={canManageShared}
          onConnect={() => onConnect(toolkit.toolkitName, 'shared')}
          onDisconnect={() => onDisconnect(toolkit.toolkitName, 'shared')}
          onToggle={(enabled) => onToggle(toolkit.toolkitName, 'shared', enabled)}
        />
      </td>
    </tr>
  )
}

function ScopeCell({
  connection,
  disabled,
  canManage,
  onConnect,
  onDisconnect,
  onToggle,
}: {
  connection?: ConnectionDto
  disabled: boolean
  canManage: boolean
  onConnect: () => void
  onDisconnect: () => void
  onToggle: (enabled: boolean) => void
}) {
  const connected = connection?.authStatus === 'completed'
  const failed = connection?.authStatus === 'failed'
  const enabled = connection?.enabled ?? false

  if (!canManage) {
    return (
      <div className="flex justify-center py-0.5">
        <span
          className="inline-flex size-7 items-center justify-center text-muted-foreground/35"
          title="Only owners and admins can manage workspace connections"
        >
          <Lock className="size-3.5" aria-hidden />
        </span>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="flex justify-center py-0.5">
        <ScopeIconButton
          icon={ShieldAlert}
          label="Connection failed — retry"
          tone="failed"
          disabled={disabled}
          onClick={onConnect}
        />
      </div>
    )
  }

  if (connected && enabled) {
    return (
      <div className="flex justify-center py-0.5">
        <ScopeIconButton
          icon={Unplug}
          label="Remove toolkit access"
          tone="connected"
          disabled={disabled}
          onClick={onDisconnect}
        />
      </div>
    )
  }

  return (
    <div className="flex justify-center py-0.5">
      <ScopeIconButton
        icon={Plug}
        label={connected ? 'Enable for planning' : 'Connect'}
        tone={connected ? 'idle' : 'default'}
        disabled={disabled}
        onClick={connected ? () => onToggle(true) : onConnect}
      />
    </div>
  )
}

function ScopeIconButton({
  icon: Icon,
  label,
  tone,
  disabled,
  onClick,
}: {
  icon: typeof Plug
  label: string
  tone: 'default' | 'idle' | 'connected' | 'failed'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'size-7 [&_svg]:size-3.5',
        tone === 'default' && 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        tone === 'idle' && 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        tone === 'connected' &&
          'text-aig-approved hover:bg-aig-approved/10 hover:text-aig-approved',
        tone === 'failed' && 'text-aig-failed hover:bg-aig-failed/10 hover:text-aig-failed',
      )}
    >
      <Icon aria-hidden />
    </Button>
  )
}

function ToolkitAvatar({ name }: { name: string }) {
  const initial = name
    .replace(/([a-z])([A-Z])/g, '$1')
    .charAt(0)
    .toUpperCase()

  return (
    <div
      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 font-mono font-semibold text-muted-foreground text-xs shadow-arcade"
      aria-hidden
    >
      {initial}
    </div>
  )
}

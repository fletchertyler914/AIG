'use client'

import { ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { AuthProviderReadinessDto } from '@/app/api/auth-providers/route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

async function fetchAuthProviders(refresh = false): Promise<AuthProviderReadinessDto> {
  const res = await fetch(`/api/auth-providers${refresh ? '?refresh=1' : ''}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as AuthProviderReadinessDto
}

export function AuthProvidersPanel() {
  const [data, setData] = useState<AuthProviderReadinessDto | null>(null)
  const [isRefreshing, startRefresh] = useTransition()

  const load = useCallback((refresh: boolean) => {
    startRefresh(async () => {
      try {
        setData(await fetchAuthProviders(refresh))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load auth providers')
      }
    })
  }, [])

  useEffect(() => {
    load(false)
  }, [load])

  const configured = data?.configuredCount ?? 0
  const total = data?.catalog.length ?? 0

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              OAuth providers
            </p>
            <h2 className="font-semibold text-lg tracking-tight">Arcade auth setup</h2>
            <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
              {data?.verifierMode === 'arcade' ? (
                <>
                  Using Arcade&apos;s built-in user verifier. Sign into arcade.dev with the same
                  email as AIG — Arcade default OAuth apps work without registering your own
                  credentials. Workspace-scoped connections require custom verifier mode.
                </>
              ) : (
                <>
                  Using a custom user verifier. Register your own OAuth apps in Arcade — one per
                  provider family (Google covers Gmail, Calendar, Drive, etc.). End users only click
                  Authorize; they never configure OAuth.
                </>
              )}
            </p>
          </div>
          <Button
            disabled={isRefreshing}
            onClick={() => load(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {data?.verifierMode === 'custom' ? (
            <SetupLink
              href={data?.customVerifierUrl ?? '#'}
              label="Custom verifier URL"
              value={data?.customVerifierUrl ?? 'Loading…'}
            />
          ) : (
            <SetupLink
              href="https://api.arcade.dev/dashboard/auth/settings"
              label="Verifier mode"
              value="Arcade user verifier"
            />
          )}
          <SetupLink
            href={data?.arcadeDashboardUrl ?? 'https://api.arcade.dev/dashboard/auth/settings'}
            label="Arcade Dashboard"
            value="Auth → Settings + Connected Apps"
          />
        </div>

        {data ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={configured > 0 ? 'success' : 'warning'}>
                {configured} / {total} provider families configured
              </Badge>
              {data.missingCount > 0 ? (
                <span className="text-muted-foreground text-xs">
                  Add providers in Arcade as you enable toolkits — not all are required upfront.
                </span>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-border border-b bg-surface-1/60 text-left">
                    <th className="px-3 py-2 font-medium text-xs">Provider</th>
                    <th className="px-3 py-2 font-medium text-xs">Status</th>
                    <th className="px-3 py-2 font-medium text-xs">Setup guide</th>
                  </tr>
                </thead>
                <tbody>
                  {data.catalog.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-border border-b last:border-0 hover:bg-surface-2/20"
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-muted-foreground text-xs">{entry.description}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        {entry.configured ? (
                          <Badge variant="success">Configured</Badge>
                        ) : (
                          <Badge variant="outline">Not configured</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <a
                          className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
                          href={entry.docsUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Docs
                          <ExternalLink className="size-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.configured.length > 0 ? (
              <details className="rounded-md border border-border bg-surface-1/40 p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Registered provider instances ({data.configured.length})
                </summary>
                <ul className="mt-3 space-y-2 text-muted-foreground text-xs">
                  {data.configured.map((row) => (
                    <li key={row.id}>
                      <span className="font-mono text-foreground">{row.id}</span>
                      {row.providerId ? ` · ${row.providerId}` : null}
                      {row.description ? ` — ${row.description}` : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="text-muted-foreground leading-relaxed">
                  {data.verifierMode === 'arcade' ? (
                    <>
                      Arcade&apos;s default OAuth apps work once you are signed into arcade.dev with
                      the same email as AIG. Custom provider registration is only required for
                      custom verifier mode (dedicated Arcade project per environment).
                    </>
                  ) : (
                    <>
                      No custom OAuth providers registered yet. With the custom user verifier
                      enabled, Arcade&apos;s default OAuth apps will not work — start with{' '}
                      <a
                        className="text-primary hover:underline"
                        href="https://docs.arcade.dev/en/references/auth-providers/google"
                        rel="noreferrer"
                        target="_blank"
                      >
                        Google
                      </a>{' '}
                      if you need Gmail or Calendar.
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Loading provider status…</p>
        )}
      </CardContent>
    </Card>
  )
}

function SetupLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a
      className="rounded-md border border-border bg-surface-1/40 p-3 transition-colors hover:bg-surface-2/30"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </a>
  )
}

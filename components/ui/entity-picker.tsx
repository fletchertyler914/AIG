'use client'

import { Check, ChevronsUpDown, Loader2, Plug } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { EntityResolverRef } from '@/lib/display/entity-resolvers'
import { formatToolkitDisplayName } from '@/lib/display/toolkits'
import { cn } from '@/lib/utils'

interface EntityOptionDto {
  value: string
  label: string
  hint?: string
}

interface EntityResolveResponse {
  status: 'ok' | 'auth_required' | 'empty' | 'error'
  toolkitName: string
  options: EntityOptionDto[]
  message?: string
}

export interface EntityPickerProps {
  id: string
  toolName: string
  parameterName: string
  resolver: EntityResolverRef
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  compact?: boolean
}

export function EntityPicker({
  id,
  toolName,
  parameterName,
  resolver,
  value,
  onChange,
  disabled = false,
  compact = false,
}: EntityPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [options, setOptions] = useState<EntityOptionDto[]>([])
  const [status, setStatus] = useState<EntityResolveResponse['status'] | 'idle'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectPending, setConnectPending] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const awaitingAuthRef = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const loadOptions = useCallback(
    async (searchQuery: string, signal?: AbortSignal) => {
      setLoading(true)
      try {
        const res = await fetch('/api/tools/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          ...(signal ? { signal } : {}),
          body: JSON.stringify({
            toolName,
            parameterName,
            ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
          }),
        })
        if (!res.ok) throw new Error(await res.text())
        const body = (await res.json()) as EntityResolveResponse
        setStatus(body.status)
        setMessage(body.message ?? null)
        setOptions(body.options)
        setActiveIndex(0)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Failed to load options')
        setOptions([])
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [toolName, parameterName],
  )

  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    const timer = window.setTimeout(() => {
      void loadOptions(query, ac.signal)
    }, 150)
    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [open, query, loadOptions])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && awaitingAuthRef.current && open) {
        awaitingAuthRef.current = false
        void loadOptions(query)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [loadOptions, open, query])

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return options
    return options.filter((option) => {
      const haystack = `${option.label} ${option.value} ${option.hint ?? ''}`.toLowerCase()
      return haystack.includes(trimmed)
    })
  }, [options, query])

  const selectedLabel = useMemo(() => {
    if (!value) return ''
    const match = options.find((option) => option.value === value)
    return match?.label ?? value
  }, [options, value])

  const selectOption = (option: EntityOptionDto) => {
    if (resolver.multiValue) {
      const lines = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      if (!lines.includes(option.value)) {
        onChange([...lines, option.value].join('\n'))
        setQuery([...lines, option.value].join('\n'))
      }
    } else {
      onChange(option.value)
      setQuery(option.value)
      setOpen(false)
    }
  }

  const connectToolkit = async () => {
    setConnectPending(true)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolkitName: resolver.toolkitName,
          scope: 'personal',
          returnTo: window.location.pathname,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const body = (await res.json()) as { connection: { authUrl: string | null } }
      if (body.connection.authUrl) {
        awaitingAuthRef.current = true
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
        toast(`Authorize ${formatToolkitDisplayName(resolver.toolkitName)} in the new tab`, {
          description: 'Options will refresh when you return.',
        })
        return
      }
      toast.success(`${formatToolkitDisplayName(resolver.toolkitName)} connected`)
      void loadOptions(query)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect toolkit')
    } finally {
      setConnectPending(false)
    }
  }

  const helperText = (() => {
    if (loading && status === 'idle') return resolver.loadingLabel
    if (status === 'auth_required') {
      return `Connect ${formatToolkitDisplayName(resolver.toolkitName)} to pick from your account.`
    }
    if (status === 'empty') return message ?? 'No items returned. Paste an ID manually.'
    if (status === 'error') return message ?? 'Could not load list — using manual entry.'
    return null
  })()

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={cn(
              'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface-1 px-3 text-left text-sm shadow-soft',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <span className={cn('truncate', !selectedLabel && 'text-muted-foreground')}>
              {selectedLabel || 'Select or type…'}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
          <div className="border-border border-b p-2">
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                const next = event.currentTarget.value
                setQuery(next)
                if (!resolver.multiValue) onChange(next)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1))
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex((current) => Math.max(current - 1, 0))
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const option = filteredOptions[activeIndex]
                  if (option) selectOption(option)
                  else if (!resolver.multiValue) {
                    onChange(query.trim())
                    setOpen(false)
                  }
                }
                if (event.key === 'Escape') setOpen(false)
              }}
              placeholder="Search or type an ID…"
              className="h-8 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
            />
          </div>

          <div
            role="listbox"
            className={cn('max-h-56 overflow-auto p-1', compact ? 'text-xs' : 'text-sm')}
          >
            {loading ? (
              <div className="flex items-center gap-2 px-2 py-3 text-muted-foreground text-xs">
                <Loader2 className="size-3.5 animate-spin" />
                {resolver.loadingLabel}
              </div>
            ) : status === 'auth_required' ? (
              <div className="space-y-2 px-2 py-3">
                <p className="text-muted-foreground text-xs leading-relaxed">{helperText}</p>
                <button
                  type="button"
                  disabled={connectPending}
                  onClick={() => void connectToolkit()}
                  className="inline-flex items-center gap-1.5 font-medium text-primary text-xs hover:underline"
                >
                  <Plug className="size-3.5" />
                  {connectPending ? 'Connecting…' : resolver.connectLabel}
                </button>
              </div>
            ) : filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-muted-foreground text-xs">
                {helperText ?? 'No matches. Press Enter to use your typed value.'}
              </p>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={`${option.value}:${option.label}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
                    index === activeIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/60',
                  )}
                >
                  <Check
                    className={cn(
                      'mt-0.5 size-3.5 shrink-0',
                      option.value === value ||
                        (resolver.multiValue && value.includes(option.value))
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {option.hint ? `${option.value} · ${option.hint}` : option.value}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {resolver.multiValue ? (
        <textarea
          id={`${id}-manual`}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className={cn(
            'w-full rounded-md border border-input bg-surface-1 px-3 py-2 font-mono text-xs shadow-soft',
            compact ? 'min-h-20' : 'min-h-24',
          )}
          placeholder="One value per line"
          spellCheck={false}
        />
      ) : null}

      {helperText && status !== 'auth_required' ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{helperText}</p>
      ) : null}
    </div>
  )
}

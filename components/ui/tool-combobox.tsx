'use client'

import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatToolMetaLine } from '@/lib/display/toolkits'
import { cn } from '@/lib/utils'

export interface ToolComboboxEntry {
  name: string
  qualifiedName: string
  actionName: string
  toolkitName: string
  toolkitDisplayName: string
  actionDisplayName: string
  description: string | null
  toolkitDescription: string | null
  version: string | null
  requiresAuth: boolean
  categories: string[]
}

interface ToolSearchResponse {
  tools: ToolComboboxEntry[]
}

export interface ToolComboboxProps {
  mode: 'tool' | 'toolkit' | 'pattern'
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  'data-testid'?: string
}

const MODE_LABELS = {
  tool: 'Search Arcade tools',
  toolkit: 'Search Arcade toolkits',
  pattern: 'Search tools or type a wildcard pattern',
} as const

export function ToolCombobox({
  mode,
  value,
  onChange,
  disabled = false,
  placeholder,
  'data-testid': testId,
}: ToolComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [entries, setEntries] = useState<ToolComboboxEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const allowFreeText = mode === 'pattern'

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (!open) return

    const ac = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams({
        mode: mode === 'toolkit' ? 'toolkit' : 'tool',
        limit: '20',
      })
      const trimmed = query.trim()
      const searchable = normalizeToolSearchQuery(trimmed)
      if (searchable) params.set('q', searchable)

      fetch(`/api/tools/search?${params.toString()}`, {
        cache: 'no-store',
        signal: ac.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(await res.text())
          return res.json() as Promise<ToolSearchResponse>
        })
        .then((body) => {
          setEntries(body.tools)
          setActiveIndex(0)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setEntries([])
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false)
        })
    }, 150)

    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [open, query, mode])

  const selectedLabel = useMemo(() => {
    if (!value) return ''
    if (mode === 'toolkit') return value
    return value
  }, [mode, value])

  const selectEntry = (entry: ToolComboboxEntry) => {
    const nextValue = mode === 'toolkit' ? entry.toolkitName : entry.name
    onChange(nextValue)
    setQuery(nextValue)
    setOpen(false)
  }

  const commitFreeText = () => {
    if (!allowFreeText) return
    onChange(query.trim())
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return
        setOpen(next)
        if (next) {
          window.requestAnimationFrame(() => inputRef.current?.focus())
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid={testId}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface-1 px-3 text-left text-sm shadow-soft',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate font-mono text-xs">
            {selectedLabel || placeholder || MODE_LABELS[mode]}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-2">
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const next = event.currentTarget.value
              setQuery(next)
              if (allowFreeText) onChange(next)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((idx) => Math.min(idx + 1, Math.max(entries.length - 1, 0)))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((idx) => Math.max(idx - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                const active = entries[activeIndex]
                if (active) selectEntry(active)
                else commitFreeText()
              } else if (event.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder={placeholder || MODE_LABELS[mode]}
            className="pl-8 font-mono text-xs"
            spellCheck={false}
          />
        </div>

        <div className="mt-2 max-h-72 overflow-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-6 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Searching Arcade tools…
            </div>
          ) : entries.length > 0 ? (
            <div className="space-y-1">
              {entries.map((entry, idx) => {
                const selected =
                  mode === 'toolkit' ? value === entry.toolkitName : value === entry.name
                const active = idx === activeIndex
                return (
                  <button
                    type="button"
                    key={`${entry.name}-${entry.toolkitName}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectEntry(entry)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors',
                      active
                        ? 'bg-surface-2 text-foreground'
                        : 'text-foreground hover:bg-surface-2',
                    )}
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      {selected ? <Check className="size-3.5 text-primary" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm">
                          {mode === 'toolkit' ? entry.toolkitDisplayName : entry.actionDisplayName}
                        </span>
                        {entry.requiresAuth ? (
                          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground uppercase">
                            Auth
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                        {mode === 'toolkit'
                          ? entry.toolkitName
                          : formatToolMetaLine(entry.name, { version: true })}
                      </span>
                      {entry.description || entry.toolkitDescription ? (
                        <span className="mt-1 line-clamp-2 block text-muted-foreground text-xs leading-relaxed">
                          {entry.description ?? entry.toolkitDescription}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="px-3 py-6 text-muted-foreground text-sm">
              No matching tools.
              {allowFreeText ? (
                <span className="mt-1 block text-xs">
                  Press Enter to use this pattern as typed, for example{' '}
                  <span className="font-mono text-foreground">Gmail.*</span>.
                </span>
              ) : null}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function normalizeToolSearchQuery(value: string): string {
  return value.replace(/\*/g, '').replace(/\.$/, '').trim()
}

'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { MutationDto } from '@/components/intent/types'
import { asRecord } from '@/components/intent/types'
import { CoAuthorshipTimeline } from '@/components/timeline/co-authorship-timeline'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface IntentTraceDrawerProps {
  mutations: MutationDto[]
}

const EVENT_LABELS: Record<string, string> = {
  agent_proposed: 'Agent proposed intent',
  human_removed: 'Human removed action',
  human_edited: 'Human edited action',
  system_invalidated: 'System invalidated dependents',
  agent_regenerated: 'Agent repaired downstream graph',
  human_approved: 'Human approved intent',
  arcade_executed: 'Arcade executed action',
}

function previewText(mutation: MutationDto): string {
  const label = EVENT_LABELS[mutation.type] ?? mutation.type
  const p = asRecord(mutation.payload)
  if (mutation.type === 'human_removed' || mutation.type === 'human_edited') {
    return `${label} · ${String(p['toolCallId'] ?? '')}`
  }
  return label
}

export function IntentTraceDrawer({ mutations }: IntentTraceDrawerProps) {
  const [open, setOpen] = useState(false)
  const latest = useMemo(() => mutations.at(-1) ?? null, [mutations])

  return (
    <div
      className={cn(
        'bottom-0 z-20 border-border border-t bg-background shadow-arcade-lg transition-[height] duration-200',
        'fixed inset-x-0 lg:relative lg:inset-x-auto lg:shadow-arcade',
        open ? 'h-[min(50vh,420px)]' : 'h-12',
      )}
    >
      <div className="flex h-12 items-center justify-between gap-3 border-border border-b px-4 sm:px-6">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="shrink-0 font-mono text-[10px] text-aig-proposed uppercase tracking-widest">
            Co-authorship trace
          </span>
          {!open && latest ? (
            <span className="truncate text-muted-foreground text-xs">{previewText(latest)}</span>
          ) : null}
          {!open && !latest ? (
            <span className="text-muted-foreground text-xs">No events yet</span>
          ) : null}
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={open ? 'Collapse trace' : 'Expand trace'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </Button>
      </div>

      {open ? (
        <div className="scrollbar-thin h-[calc(100%-3rem)] overflow-auto px-4 py-4 sm:px-6">
          <CoAuthorshipTimeline mutations={mutations} />
        </div>
      ) : null}
    </div>
  )
}

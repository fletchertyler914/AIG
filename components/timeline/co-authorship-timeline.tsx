'use client'

import { Bot, CheckCircle2, CircleAlert, PenLine, ShieldCheck, Trash2, Zap } from 'lucide-react'
import type { ComponentType } from 'react'
import type { MutationDto } from '@/components/intent/types'
import { asRecord } from '@/components/intent/types'
import { cn } from '@/lib/utils'

interface CoAuthorshipTimelineProps {
  mutations: MutationDto[]
}

const eventStyles: Record<
  string,
  { label: string; className: string; icon: ComponentType<{ className?: string }> }
> = {
  agent_proposed: {
    label: 'Agent proposed intent',
    className: 'border-aig-proposed/30 bg-aig-proposed/10 text-aig-proposed',
    icon: Bot,
  },
  human_removed: {
    label: 'Human removed action',
    className: 'border-aig-removed/30 bg-aig-removed/10 text-aig-removed',
    icon: Trash2,
  },
  human_edited: {
    label: 'Human edited action',
    className: 'border-aig-edited/30 bg-aig-edited/10 text-aig-edited',
    icon: PenLine,
  },
  system_invalidated: {
    label: 'System invalidated dependents',
    className: 'border-aig-regenerated/30 bg-aig-regenerated/10 text-aig-regenerated',
    icon: CircleAlert,
  },
  agent_regenerated: {
    label: 'Agent repaired downstream graph',
    className: 'border-aig-regenerated/30 bg-aig-regenerated/10 text-aig-regenerated',
    icon: Zap,
  },
  human_approved: {
    label: 'Human approved intent',
    className: 'border-aig-approved/30 bg-aig-approved/10 text-aig-approved',
    icon: ShieldCheck,
  },
  arcade_executed: {
    label: 'Arcade executed action',
    className: 'border-aig-executed/30 bg-aig-executed/10 text-aig-executed',
    icon: CheckCircle2,
  },
}

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(ts)
}

function summarizePayload(type: string, payload: unknown): string {
  const p = asRecord(payload)
  if (type === 'agent_proposed') {
    return `${String(p['toolCallCount'] ?? 0)} tool calls across ${String(
      (p['systems'] as string[] | undefined)?.join(', ') ?? 'systems',
    )}`
  }
  if (type === 'human_removed' || type === 'human_edited') {
    return `${String(p['toolCallId'] ?? 'unknown action')}${
      p['reason'] ? ` · ${String(p['reason'])}` : ''
    }`
  }
  if (type === 'system_invalidated') {
    const ids = p['invalidatedIds']
    return Array.isArray(ids)
      ? `${ids.length} downstream action(s) invalidated`
      : 'Dependents invalidated'
  }
  if (type === 'agent_regenerated') {
    const inserted = p['insertedToolCallIds']
    return Array.isArray(inserted)
      ? `${inserted.length} replacement action(s) inserted`
      : 'Graph repaired'
  }
  if (type === 'human_approved') return String(p['approvedBy'] ?? 'Approved')
  return JSON.stringify(payload)
}

export function CoAuthorshipTimeline({ mutations }: CoAuthorshipTimelineProps) {
  if (mutations.length === 0) {
    return (
      <div className="rounded-lg border border-border border-dashed bg-surface-1/50 p-6 text-center text-muted-foreground text-sm">
        No co-authorship events yet.
      </div>
    )
  }

  return (
    <ol className="space-y-3">
      {mutations.map((mutation, index) => {
        const style = eventStyles[mutation.type] ?? {
          label: mutation.type,
          className: 'border-border bg-surface-2 text-muted-foreground',
          icon: Bot,
        }
        const Icon = style.icon
        const isLast = index === mutations.length - 1
        return (
          <li
            key={mutation.id}
            className="relative pl-10"
            data-testid="trace-entry"
            data-event-type={mutation.type}
          >
            {!isLast ? (
              <span
                aria-hidden
                className="absolute top-9 bottom-[-0.75rem] left-[15px] w-px bg-border"
              />
            ) : null}
            <span
              className={cn(
                'absolute top-1 left-0 flex size-8 items-center justify-center rounded-full border',
                style.className,
              )}
              aria-hidden
            >
              <Icon className="size-3.5" />
            </span>
            <article className="rounded-md border border-border bg-surface-1 p-3 shadow-arcade">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-sm">{style.label}</h3>
                <time className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  {formatTime(mutation.ts)}
                </time>
              </div>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                {summarizePayload(mutation.type, mutation.payload)}
              </p>
            </article>
          </li>
        )
      })}
    </ol>
  )
}

'use client'

import { Lock } from 'lucide-react'
import { useMemo } from 'react'
import type { ToolCallDto } from '@/components/intent/types'
import { ToolCallStatusBadge } from '@/components/ui/badge'
import { formatToolActionTitle, formatToolMetaLine } from '@/lib/display/toolkits'
import { cn } from '@/lib/utils'

function computeDepths(toolCalls: ToolCallDto[]): Map<string, number> {
  const byId = new Map(toolCalls.map((tc) => [tc.id, tc]))
  const depths = new Map<string, number>()

  function depth(id: string, visiting: Set<string>): number {
    const cached = depths.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0
    visiting.add(id)
    const tc = byId.get(id)
    if (!tc || tc.dependsOn.length === 0) {
      depths.set(id, 0)
      visiting.delete(id)
      return 0
    }
    const d = Math.max(...tc.dependsOn.map((dep) => depth(dep, visiting))) + 1
    depths.set(id, d)
    visiting.delete(id)
    return d
  }

  for (const tc of toolCalls) {
    depth(tc.id, new Set())
  }
  return depths
}

interface IntentCanvasListProps {
  toolCalls: ToolCallDto[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  disabled?: boolean
}

export function IntentCanvasList({
  toolCalls,
  selectedId,
  onSelect,
  disabled = false,
}: IntentCanvasListProps) {
  const layers = useMemo(() => {
    const depths = computeDepths(toolCalls)
    const max = Math.max(0, ...Array.from(depths.values()))
    const grouped: ToolCallDto[][] = Array.from({ length: max + 1 }, () => [])
    for (const tc of toolCalls) {
      const d = depths.get(tc.id) ?? 0
      grouped[d]?.push(tc)
    }
    return grouped
      .map((layer, layerIndex) => ({ layer, layerIndex }))
      .filter(({ layer }) => layer.length > 0)
  }, [toolCalls])

  const byId = useMemo(() => new Map(toolCalls.map((tc) => [tc.id, tc])), [toolCalls])

  if (toolCalls.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border border-border border-dashed bg-surface-1 p-8 text-center text-muted-foreground text-sm">
        No actions in this intent.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', disabled && 'pointer-events-none opacity-50')}>
      {layers.map(({ layer, layerIndex }) => {
        const layerKey = layer.map((tc) => tc.id).join('-')
        return (
          <div key={layerKey}>
            <p className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Layer {layerIndex}
            </p>
            <ul className="space-y-2">
              {layer.map((toolCall) => {
                const selected = selectedId === toolCall.id
                const locked =
                  toolCall.locked || toolCall.status === 'invalidated' || toolCall.status === 'done'

                return (
                  <li key={toolCall.id}>
                    <button
                      type="button"
                      data-testid="tool-call-card"
                      data-tool={toolCall.tool}
                      data-status={toolCall.status}
                      disabled={disabled}
                      onClick={() => onSelect(selected ? null : toolCall.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-md border bg-card p-3 text-left shadow-arcade transition-colors',
                        selected
                          ? 'border-primary shadow-arcade-lg'
                          : 'border-border hover:border-border-strong',
                        toolCall.status === 'invalidated' && 'opacity-60',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm" data-testid="tool-call-name">
                          {formatToolActionTitle(toolCall.tool)}
                        </p>
                        <p className="mt-0.5 text-muted-foreground text-xs">
                          {formatToolMetaLine(toolCall.tool)}
                          {toolCall.dependsOn.length > 0
                            ? ` · after ${toolCall.dependsOn
                                .map((dep) => {
                                  const depCall = byId.get(dep)
                                  return depCall ? formatToolActionTitle(depCall.tool) : dep
                                })
                                .join(', ')}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {locked ? <Lock className="size-3.5 text-muted-foreground" /> : null}
                        <span data-testid="tool-call-status">
                          <ToolCallStatusBadge status={toolCall.status} />
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import dagre from 'dagre'
import { Lock } from 'lucide-react'
import { useMemo } from 'react'
import type { ToolCallDto } from '@/components/intent/types'
import { ToolCallStatusBadge } from '@/components/ui/badge'
import { formatToolActionTitle, formatToolMetaLine } from '@/lib/display/toolkits'
import { cn } from '@/lib/utils'

const NODE_WIDTH = 220
const NODE_HEIGHT = 72

interface LayoutNode {
  toolCall: ToolCallDto
  x: number
  y: number
}

interface LayoutEdge {
  from: string
  to: string
  points: Array<{ x: number; y: number }>
}

interface DagLayout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  width: number
  height: number
}

function layoutDag(toolCalls: ToolCallDto[]): DagLayout {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 56, ranksep: 72, marginx: 24, marginy: 24 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const tc of toolCalls) {
    g.setNode(tc.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const tc of toolCalls) {
    for (const dep of tc.dependsOn) {
      if (g.hasNode(dep)) {
        g.setEdge(dep, tc.id)
      }
    }
  }

  dagre.layout(g)

  const nodes: LayoutNode[] = toolCalls.map((tc) => {
    const n = g.node(tc.id) as { x: number; y: number }
    return {
      toolCall: tc,
      x: n.x - NODE_WIDTH / 2,
      y: n.y - NODE_HEIGHT / 2,
    }
  })

  const edges: LayoutEdge[] = g.edges().map((e) => {
    const edge = g.edge(e) as { points: Array<{ x: number; y: number }> }
    return { from: e.v, to: e.w, points: edge.points }
  })

  const graphMeta = g.graph() as { width?: number; height?: number }
  return {
    nodes,
    edges,
    width: Math.max(graphMeta.width ?? 400, 320),
    height: Math.max(graphMeta.height ?? 240, 200),
  }
}

function edgePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  let d = `M ${first?.x ?? 0} ${first?.y ?? 0}`
  for (const p of rest) {
    d += ` L ${p.x} ${p.y}`
  }
  return d
}

interface IntentCanvasProps {
  toolCalls: ToolCallDto[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  disabled?: boolean
}

export function IntentCanvas({
  toolCalls,
  selectedId,
  onSelect,
  disabled = false,
}: IntentCanvasProps) {
  const layout = useMemo(() => layoutDag(toolCalls), [toolCalls])

  if (toolCalls.length === 0) {
    return (
      <div className="grid-bg flex min-h-[440px] flex-1 items-center justify-center rounded-md border border-border bg-surface-1 p-8">
        <div className="max-w-sm rounded-md border border-border bg-card px-6 py-8 text-center shadow-arcade">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            Empty graph
          </p>
          <p className="mt-2 font-medium text-sm">No actions in this intent.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid-bg relative flex min-h-[440px] flex-1 overflow-auto rounded-md border border-border bg-surface-1',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <svg
        width={layout.width}
        height={layout.height}
        role="img"
        aria-label="Intent dependency graph"
        className="m-auto block shrink-0"
      >
        <defs>
          <marker id="dag-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
          </marker>
        </defs>

        {layout.edges.map((edge) => (
          <path
            key={`${edge.from}-${edge.to}`}
            d={edgePath(edge.points)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            markerEnd="url(#dag-arrow)"
          />
        ))}

        {layout.nodes.map(({ toolCall, x, y }) => {
          const selected = selectedId === toolCall.id
          const locked =
            toolCall.locked || toolCall.status === 'invalidated' || toolCall.status === 'done'

          return (
            <foreignObject key={toolCall.id} x={x} y={y} width={NODE_WIDTH} height={NODE_HEIGHT}>
              <button
                type="button"
                data-testid="tool-call-card"
                data-tool={toolCall.tool}
                data-status={toolCall.status}
                disabled={disabled}
                onClick={() => onSelect(selected ? null : toolCall.id)}
                className={cn(
                  'flex h-full w-full flex-col justify-between rounded-md border bg-card p-2.5 text-left transition-[box-shadow,transform] duration-100',
                  selected
                    ? 'border-primary shadow-arcade-lg'
                    : 'border-border shadow-arcade hover:border-border-strong',
                  toolCall.status === 'invalidated' && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] text-muted-foreground">
                      {formatToolMetaLine(toolCall.tool)}
                    </p>
                    <p
                      className="mt-0.5 truncate font-semibold text-sm leading-tight"
                      data-testid="tool-call-name"
                    >
                      {formatToolActionTitle(toolCall.tool)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {locked ? <Lock className="size-3 text-muted-foreground" aria-hidden /> : null}
                    <span data-testid="tool-call-status">
                      <ToolCallStatusBadge status={toolCall.status} size="sm" />
                    </span>
                  </div>
                </div>
                <p className="truncate font-mono text-[9px] text-muted-foreground">
                  {toolCall.dependsOn.length > 0 ? `deps: ${toolCall.dependsOn.length}` : 'no deps'}
                </p>
              </button>
            </foreignObject>
          )
        })}
      </svg>
    </div>
  )
}

export { layoutDag, NODE_HEIGHT, NODE_WIDTH }

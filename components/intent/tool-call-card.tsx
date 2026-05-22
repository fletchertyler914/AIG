'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ToolCallDto } from '@/components/intent/types'
import { prettyJson } from '@/components/intent/types'
import { cn } from '@/lib/utils'

interface ToolCallCardProps {
  toolCall: ToolCallDto
  onChanged: () => Promise<void>
}

function statusClass(status: string): string {
  switch (status) {
    case 'invalidated':
      return 'border-aig-removed/40 bg-aig-removed/10 text-aig-removed'
    case 'approved':
    case 'done':
      return 'border-aig-approved/40 bg-aig-approved/10 text-aig-approved'
    case 'failed':
      return 'border-aig-failed/40 bg-aig-failed/10 text-aig-failed'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

export function ToolCallCard({ toolCall, onChanged }: ToolCallCardProps) {
  const [editing, setEditing] = useState(false)
  const [argsText, setArgsText] = useState(prettyJson(toolCall.args))
  const [isPending, startTransition] = useTransition()

  const remove = () => {
    startTransition(async () => {
      const res = await fetch(`/api/intents/${toolCall.intentId}/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'remove',
          toolCallId: toolCall.id,
          reason: 'Operator removed this action in review.',
        }),
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      toast.success('Action removed and downstream graph repaired')
      await onChanged()
    })
  }

  const save = () => {
    startTransition(async () => {
      let args: unknown
      try {
        args = JSON.parse(argsText)
      } catch {
        toast.error('Args must be valid JSON')
        return
      }

      const res = await fetch(`/api/intents/${toolCall.intentId}/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'edit',
          toolCallId: toolCall.id,
          args,
          reason: 'Operator edited args during review.',
        }),
      })
      if (!res.ok) {
        toast.error(await res.text())
        return
      }
      toast.success('Action edited')
      setEditing(false)
      await onChanged()
    })
  }

  return (
    <article
      className="rounded-lg border bg-card p-4 shadow-sm"
      data-testid="tool-call-card"
      data-tool={toolCall.tool}
      data-status={toolCall.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium font-mono text-sm" data-testid="tool-call-name">
            {toolCall.tool}
          </h3>
          <p className="mt-1 text-muted-foreground text-xs">
            depends on: {toolCall.dependsOn.length > 0 ? toolCall.dependsOn.join(', ') : 'none'}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-wide',
            statusClass(toolCall.status),
          )}
          data-testid="tool-call-status"
        >
          {toolCall.status}
        </span>
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <textarea
            className="min-h-48 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none ring-ring transition focus:ring-2"
            value={argsText}
            onChange={(event) => setArgsText(event.currentTarget.value)}
          />
          <div className="flex gap-2">
            <button
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm disabled:opacity-50"
              disabled={isPending}
              onClick={save}
              type="button"
            >
              Save edit
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm"
              disabled={isPending}
              onClick={() => setEditing(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-3 text-xs">
          {prettyJson(toolCall.args)}
        </pre>
      )}

      <div className="mt-4 flex gap-2">
        <button
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          data-testid="tool-call-edit"
          disabled={toolCall.locked || isPending || toolCall.status === 'invalidated'}
          onClick={() => setEditing(true)}
          type="button"
        >
          Edit args
        </button>
        <button
          className="rounded-md border border-aig-removed/40 px-3 py-2 text-aig-removed text-sm disabled:opacity-50"
          data-testid="tool-call-remove"
          disabled={toolCall.locked || isPending || toolCall.status === 'invalidated'}
          onClick={remove}
          type="button"
        >
          Remove
        </button>
      </div>
    </article>
  )
}

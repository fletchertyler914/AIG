'use client'

import { Braces, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArgsFormFields } from '@/components/intent/args-form-fields'
import type { ToolCallDto } from '@/components/intent/types'
import { asRecord, prettyJson } from '@/components/intent/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { type ArgField, argsToFields, fieldsToArgs } from '@/lib/display/args-form'
import { cn } from '@/lib/utils'

interface ToolCallArgsEditorProps {
  toolCall: ToolCallDto
  onChanged: () => Promise<void>
  compact?: boolean
}

type EditMode = 'form' | 'json'

export function ToolCallArgsEditor({
  toolCall,
  onChanged,
  compact = false,
}: ToolCallArgsEditorProps) {
  const [editing, setEditing] = useState(false)
  const [editMode, setEditMode] = useState<EditMode>('form')
  const [fields, setFields] = useState<ArgField[]>([])
  const [argsText, setArgsText] = useState(prettyJson(toolCall.args))
  const [isPending, setIsPending] = useState(false)

  const formFields = useMemo(
    () => argsToFields(toolCall.args, { toolName: toolCall.tool }),
    [toolCall.args, toolCall.tool],
  )
  const canUseForm = formFields !== null

  useEffect(() => {
    setArgsText(prettyJson(toolCall.args))
    if (formFields) setFields(formFields)
    if (!editing) setEditMode(canUseForm ? 'form' : 'json')
  }, [toolCall.args, formFields, canUseForm, editing])

  const locked = toolCall.locked || toolCall.status === 'invalidated' || toolCall.status === 'done'

  const persist = (args: Record<string, unknown>) => {
    void (async () => {
      setIsPending(true)
      try {
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
      } finally {
        setIsPending(false)
      }
    })()
  }

  const remove = () => {
    void (async () => {
      setIsPending(true)
      try {
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
      } finally {
        setIsPending(false)
      }
    })()
  }

  const save = () => {
    if (editMode === 'form' && canUseForm) {
      persist(fieldsToArgs(fields, asRecord(toolCall.args)))
      return
    }

    let args: unknown
    try {
      args = JSON.parse(argsText)
    } catch {
      toast.error('Args must be valid JSON')
      return
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      toast.error('Args must be a JSON object')
      return
    }
    persist(args as Record<string, unknown>)
  }

  const cancel = () => {
    setArgsText(prettyJson(toolCall.args))
    if (formFields) setFields(formFields)
    setEditing(false)
    setEditMode(canUseForm ? 'form' : 'json')
  }

  const startEditing = () => {
    setEditMode(canUseForm ? 'form' : 'json')
    setEditing(true)
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <div className="space-y-3">
          {canUseForm ? (
            <div className="inline-flex border border-border bg-surface-2 p-0.5">
              <button
                type="button"
                onClick={() => setEditMode('form')}
                className={cn(
                  'px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors',
                  editMode === 'form'
                    ? 'bg-background text-foreground shadow-arcade'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Form
              </button>
              <button
                type="button"
                onClick={() => setEditMode('json')}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors',
                  editMode === 'json'
                    ? 'bg-background text-foreground shadow-arcade'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Braces className="size-3" />
                JSON
              </button>
            </div>
          ) : null}

          {editMode === 'form' && canUseForm ? (
            <ArgsFormFields
              fields={fields}
              editing
              compact={compact}
              toolName={toolCall.tool}
              onChange={(key, value) => {
                setFields((current) =>
                  current.map((field) => (field.key === key ? { ...field, value } : field)),
                )
              }}
            />
          ) : (
            <Textarea
              className={cn('font-mono text-xs', compact ? 'min-h-36' : 'min-h-48')}
              value={argsText}
              onChange={(event) => setArgsText(event.currentTarget.value)}
              spellCheck={false}
            />
          )}

          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={save}>
              {isPending ? 'Saving…' : 'Save edit'}
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : canUseForm && formFields ? (
        <div className="rounded-md border border-border bg-surface-2/60 p-3">
          <ArgsFormFields
            fields={formFields}
            editing={false}
            toolName={toolCall.tool}
            onChange={() => {}}
            compact={compact}
          />
        </div>
      ) : (
        <pre className="scrollbar-thin max-h-72 overflow-auto rounded-md border border-border bg-surface-2/60 p-3 font-mono text-foreground/90 text-xs leading-relaxed">
          {prettyJson(toolCall.args)}
        </pre>
      )}

      {!editing ? (
        <div className="flex flex-wrap gap-2 border-border border-t pt-4">
          <Button
            size="sm"
            variant="outline"
            data-testid="tool-call-edit"
            disabled={locked || isPending}
            onClick={startEditing}
            className="gap-2"
          >
            <Pencil className="size-3.5" />
            Edit args
          </Button>
          <Button
            size="sm"
            variant="danger"
            data-testid="tool-call-remove"
            disabled={locked || isPending}
            onClick={remove}
            className="gap-2"
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { Braces, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArgsFormFields } from '@/components/intent/args-form-fields'
import { prettyJson } from '@/components/intent/types'
import { Textarea } from '@/components/ui/input'
import {
  type ArcadeToolInputSchema,
  type ArgField,
  fieldsToArgs,
  schemaToFields,
} from '@/lib/display/args-form'
import { cn } from '@/lib/utils'

interface ToolDetailResponse {
  tool: {
    name: string
    input: ArcadeToolInputSchema
  }
}

interface ToolArgsFormProps {
  tool: string
  disabled?: boolean
  onArgsChange: (args: Record<string, unknown> | null) => void
}

type ArgsMode = 'form' | 'json'

export function ToolArgsForm({ tool, disabled = false, onArgsChange }: ToolArgsFormProps) {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ArgsMode>('form')
  const [fields, setFields] = useState<ArgField[]>([])
  const [jsonText, setJsonText] = useState('{\n  \n}')
  const [canUseForm, setCanUseForm] = useState(true)

  useEffect(() => {
    if (!tool.trim()) {
      setFields([])
      setJsonText('{\n  \n}')
      setCanUseForm(true)
      setMode('form')
      onArgsChange({})
      return
    }

    const ac = new AbortController()
    setLoading(true)
    fetch(`/api/tools/${encodeURIComponent(tool)}`, { cache: 'no-store', signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json() as Promise<ToolDetailResponse>
      })
      .then((body) => {
        const nextFields = schemaToFields(body.tool.input)
        if (nextFields) {
          setFields(nextFields)
          setCanUseForm(true)
          setMode('form')
          onArgsChange(fieldsToArgs(nextFields, {}))
          return
        }
        setCanUseForm(false)
        setMode('json')
        setJsonText('{\n  \n}')
        onArgsChange({})
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        toast.error(error instanceof Error ? error.message : 'Failed to load tool schema')
        setCanUseForm(false)
        setMode('json')
        onArgsChange(null)
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })

    return () => ac.abort()
  }, [tool, onArgsChange])

  const currentArgs = useMemo(
    () => stripEmptyOptionalArgs(fieldsToArgs(fields, {}), fields),
    [fields],
  )

  useEffect(() => {
    if (mode === 'form' && canUseForm) onArgsChange(currentArgs)
  }, [mode, canUseForm, currentArgs, onArgsChange])

  if (!tool.trim()) {
    return (
      <div className="rounded-md border border-border border-dashed bg-surface-2/40 p-3 text-muted-foreground text-xs">
        Select a tool to load its required arguments.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2/40 p-3 text-muted-foreground text-xs">
        <Loader2 className="size-3.5 animate-spin" />
        Loading Arcade tool schema…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {canUseForm ? (
        <div className="inline-flex border border-border bg-surface-2 p-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMode('form')}
            className={cn(
              'px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors',
              mode === 'form'
                ? 'bg-background text-foreground shadow-arcade'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Form
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setJsonText(prettyJson(currentArgs))
              setMode('json')
            }}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors',
              mode === 'json'
                ? 'bg-background text-foreground shadow-arcade'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Braces className="size-3" />
            JSON
          </button>
        </div>
      ) : null}

      {mode === 'form' && canUseForm ? (
        fields.length > 0 ? (
          <ArgsFormFields
            fields={fields}
            editing
            compact
            onChange={(key, value) => {
              setFields((current) =>
                current.map((field) => (field.key === key ? { ...field, value } : field)),
              )
            }}
          />
        ) : (
          <div className="rounded-md border border-border border-dashed bg-surface-2/40 p-3 text-muted-foreground text-xs">
            This tool takes no arguments.
          </div>
        )
      ) : (
        <div className="space-y-2">
          {!canUseForm ? (
            <p className="text-muted-foreground text-xs">
              This tool has an input shape that needs JSON editing.
            </p>
          ) : null}
          <Textarea
            className="min-h-32 font-mono text-xs"
            disabled={disabled}
            value={jsonText}
            onChange={(event) => {
              const next = event.currentTarget.value
              setJsonText(next)
              try {
                const parsed = JSON.parse(next) as unknown
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  onArgsChange(parsed as Record<string, unknown>)
                } else {
                  onArgsChange(null)
                }
              } catch {
                onArgsChange(null)
              }
            }}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  )
}

function stripEmptyOptionalArgs(
  args: Record<string, unknown>,
  fields: ReadonlyArray<ArgField>,
): Record<string, unknown> {
  const out = { ...args }
  for (const field of fields) {
    if (field.required) continue
    const value = out[field.key]
    if (value === '') delete out[field.key]
    if (Array.isArray(value) && value.length === 0) delete out[field.key]
  }
  return out
}

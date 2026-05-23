'use client'

import { EntityPicker } from '@/components/ui/entity-picker'
import { FieldLabel, Input, Textarea } from '@/components/ui/input'
import type { ArgField } from '@/lib/display/args-form'
import { formatArgDisplayValue } from '@/lib/display/args-form'
import { cn } from '@/lib/utils'

interface ArgsFormFieldsProps {
  fields: ArgField[]
  editing: boolean
  onChange: (key: string, value: ArgField['value']) => void
  compact?: boolean
  toolName?: string
}

export function ArgsFormFields({
  fields,
  editing,
  onChange,
  compact = false,
  toolName,
}: ArgsFormFieldsProps) {
  return (
    <dl className="space-y-3">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <FieldLabel htmlFor={`arg-${field.key}`} className="text-muted-foreground text-xs">
            {field.label}
            {field.required ? <span className="text-primary"> *</span> : null}
          </FieldLabel>
          {editing && field.description ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed">{field.description}</p>
          ) : null}
          {editing ? (
            <ArgFieldInput
              field={field}
              compact={compact}
              toolName={toolName}
              onChange={(value) => onChange(field.key, value)}
            />
          ) : (
            <dd
              className={cn(
                'text-sm leading-relaxed',
                field.type === 'text' ? 'whitespace-pre-wrap' : '',
              )}
            >
              {formatArgDisplayValue(field)}
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}

interface ArgFieldInputProps {
  field: ArgField
  compact: boolean
  toolName?: string | undefined
  onChange: (value: ArgField['value']) => void
}

function ArgFieldInput({ field, compact, toolName, onChange }: ArgFieldInputProps) {
  const id = `arg-${field.key}`

  if (field.resolver && toolName && editingSupportsResolver(field)) {
    return (
      <EntityPicker
        id={id}
        toolName={toolName}
        parameterName={field.key}
        resolver={field.resolver}
        value={String(field.value)}
        onChange={onChange}
        compact={compact}
      />
    )
  }

  if (field.type === 'boolean') {
    const checked = field.value === true
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
          className="size-4 rounded border border-input accent-primary"
        />
        <span>{checked ? 'Enabled' : 'Disabled'}</span>
      </label>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <select
        id={id}
        value={String(field.value)}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={cn(
          'h-9 w-full rounded-md border border-input bg-surface-1 px-3 text-sm shadow-soft',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        )}
      >
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'text' || field.type === 'string-list') {
    const emailList = field.type === 'string-list' && /email|attendee|recipient/i.test(field.key)
    return (
      <Textarea
        id={id}
        value={String(field.value)}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={cn(
          'text-sm',
          compact ? 'min-h-28' : 'min-h-36',
          emailList ? '' : 'font-mono text-xs',
        )}
        spellCheck={field.type === 'text'}
        placeholder={
          field.type === 'string-list'
            ? emailList
              ? 'One email address per line'
              : 'One value per line'
            : undefined
        }
      />
    )
  }

  const inputType =
    field.type === 'number'
      ? 'number'
      : field.type === 'email'
        ? 'email'
        : field.type === 'url'
          ? 'url'
          : field.type === 'date'
            ? 'date'
            : field.type === 'datetime'
              ? 'datetime-local'
              : 'text'

  return (
    <Input
      id={id}
      type={inputType}
      value={String(field.value)}
      onChange={(event) =>
        onChange(
          field.type === 'number' ? Number(event.currentTarget.value) : event.currentTarget.value,
        )
      }
      className={cn(inputType === 'text' ? 'text-sm' : 'font-mono text-xs')}
    />
  )
}

function editingSupportsResolver(field: ArgField): boolean {
  return field.type === 'string' || field.type === 'string-list'
}

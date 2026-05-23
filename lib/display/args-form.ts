/**
 * Infer a simple labeled form from flat Arcade tool args.
 * Pure — safe for components and unit tests.
 */

export type ArgFieldType =
  | 'string'
  | 'text'
  | 'boolean'
  | 'number'
  | 'string-list'
  | 'email'
  | 'url'
  | 'date'
  | 'datetime'
  | 'select'

export interface ArgField {
  key: string
  label: string
  type: ArgFieldType
  value: string | boolean | number
  required?: boolean
  description?: string
  /** Options for select fields. */
  options?: readonly string[]
}

export interface ArcadeToolInputSchema {
  parameters?: Array<{
    name: string
    description?: string
    required?: boolean
    value_schema?: {
      val_type?: string
      inner_val_type?: string
      enum?: string[]
    }
  }>
}

const ISO_DATETIME_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
const ISO_DATE_RX = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Known enum-like Arcade args → option lists. */
const SELECT_OPTIONS: Record<string, readonly string[]> = {
  content_type: ['plain', 'html'],
  send_notifications_to_attendees: ['none', 'all', 'externalOnly'],
}

function splitWords(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
}

/** Turn `recipient` / `content_type` into readable labels. */
export function formatArgFieldLabel(key: string): string {
  const words = splitWords(key).split(/\s+/).filter(Boolean)
  if (words.length === 0) return key
  const [first, ...rest] = words
  if (!first) return key
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest.map((w) => w.toLowerCase())].join(
    ' ',
  )
}

function isEmailKey(key: string): boolean {
  return /(^|_)email(s)?($|_)|recipient|attendee|to_address|from_address|cc_|bcc_/i.test(key)
}

function isUrlKey(key: string): boolean {
  return /(^|_)(url|link|href|website)($|_)/i.test(key)
}

function isDatetimeKey(key: string): boolean {
  return /datetime|_at$|starts_at|ends_at|start_time|end_time|scheduled|timestamp/i.test(key)
}

function isDateKey(key: string): boolean {
  return /(^|_)date($|_)|birthday|due_date/i.test(key) && !/datetime/i.test(key)
}

function looksLikeIsoDatetime(value: string): boolean {
  return ISO_DATETIME_RX.test(value) || (value.includes('T') && !Number.isNaN(Date.parse(value)))
}

function looksLikeIsoDate(value: string): boolean {
  return ISO_DATE_RX.test(value)
}

function looksLikeEmail(value: string): boolean {
  return EMAIL_RX.test(value.trim())
}

export function getSelectOptions(key: string): readonly string[] | undefined {
  return SELECT_OPTIONS[key]
}

/** Map ISO datetime to `datetime-local` value (`YYYY-MM-DDTHH:mm`). */
export function isoToDatetimeLocalValue(iso: string): string {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (match) return `${match[1]}T${match[2]}`

  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso

  const date = new Date(parsed)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Map `datetime-local` back to ISO, preserving seconds + offset from the original when present. */
export function datetimeLocalToIsoValue(local: string, originalIso?: string): string {
  const trimmed = local.trim()
  if (!trimmed) return trimmed

  const [datePart, timePart] = trimmed.split('T')
  if (!datePart || !timePart) return trimmed

  const seconds = originalIso?.match(/T\d{2}:\d{2}:(\d{2})/)?.[1] ?? '00'
  const offset = originalIso?.match(/(Z|[+-]\d{2}:\d{2})$/)?.[1] ?? ''
  const [hours, minutes] = timePart.split(':')
  if (!hours || !minutes) return trimmed

  return `${datePart}T${hours}:${minutes}:${seconds}${offset}`
}

export function inferFieldType(key: string, value: unknown): ArgFieldType | 'unsupported' {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (Array.isArray(value)) {
    if (value.length === 0 || value.every((item) => typeof item === 'string')) return 'string-list'
    return 'unsupported'
  }
  if (typeof value === 'string') {
    const selectOptions = getSelectOptions(key)
    if (selectOptions?.includes(value)) return 'select'

    if (looksLikeIsoDatetime(value) || (isDatetimeKey(key) && value.includes('T')))
      return 'datetime'
    if (looksLikeIsoDate(value) || (isDateKey(key) && !value.includes('T'))) return 'date'
    if (isEmailKey(key) || looksLikeEmail(value)) return 'email'
    if (isUrlKey(key) || /^https?:\/\//i.test(value)) return 'url'
    if (value.includes('\n') || /body|message|description|notes/i.test(key)) return 'text'
    return 'string'
  }
  return 'unsupported'
}

/** Returns labeled fields when args are a flat primitive map; otherwise null → use JSON. */
export function argsToFields(args: unknown): ArgField[] | null {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null

  const record = args as Record<string, unknown>
  const fields: ArgField[] = []

  for (const [key, value] of Object.entries(record)) {
    const type = inferFieldType(key, value)
    if (type === 'unsupported') return null

    if (type === 'boolean') {
      fields.push({ key, label: formatArgFieldLabel(key), type, value: value as boolean })
      continue
    }
    if (type === 'number') {
      fields.push({ key, label: formatArgFieldLabel(key), type, value: value as number })
      continue
    }
    if (type === 'string-list') {
      const items = Array.isArray(value) ? (value as string[]) : []
      fields.push({
        key,
        label: formatArgFieldLabel(key),
        type,
        value: items.join('\n'),
      })
      continue
    }
    if (type === 'select') {
      const options = getSelectOptions(key) ?? [String(value)]
      fields.push({
        key,
        label: formatArgFieldLabel(key),
        type,
        value: String(value),
        options,
      })
      continue
    }
    if (type === 'datetime') {
      fields.push({
        key,
        label: formatArgFieldLabel(key),
        type,
        value: isoToDatetimeLocalValue(String(value)),
      })
      continue
    }

    fields.push({
      key,
      label: formatArgFieldLabel(key),
      type,
      value: String(value ?? ''),
    })
  }

  return fields.sort((a, b) => a.key.localeCompare(b.key))
}

/** Build an empty editable arg form from Arcade's `ToolDefinition.input`. */
export function schemaToFields(input: unknown): ArgField[] | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return []

  const schema = input as ArcadeToolInputSchema
  const parameters = schema.parameters ?? []
  const fields: ArgField[] = []

  for (const parameter of parameters) {
    const field = parameterToField(parameter)
    if (!field) return null
    fields.push(field)
  }

  return fields.sort((a, b) => a.key.localeCompare(b.key))
}

function parameterToField(
  parameter: NonNullable<ArcadeToolInputSchema['parameters']>[number],
): ArgField | null {
  const key = parameter.name
  const valueSchema = parameter.value_schema
  const base = {
    key,
    label: formatArgFieldLabel(key),
    required: parameter.required ?? false,
    ...(parameter.description ? { description: parameter.description } : {}),
  }
  const enumOptions = valueSchema?.enum?.filter((value) => value.length > 0)
  if (enumOptions && enumOptions.length > 0) {
    return {
      ...base,
      type: 'select',
      value: enumOptions[0] ?? '',
      options: enumOptions,
    }
  }

  const valType = valueSchema?.val_type?.toLowerCase()
  if (!valType || valType === 'string' || valType === 'str') {
    const type = inferFieldType(key, '')
    return {
      ...base,
      type: type === 'unsupported' ? 'string' : type,
      value: '',
    }
  }
  if (valType === 'boolean' || valType === 'bool') {
    return { ...base, type: 'boolean', value: false }
  }
  if (valType === 'number' || valType === 'integer' || valType === 'float' || valType === 'int') {
    return { ...base, type: 'number', value: 0 }
  }
  if (valType === 'array' && valueSchema?.inner_val_type?.toLowerCase() === 'string') {
    return { ...base, type: 'string-list', value: '' }
  }
  if (valType === 'datetime') {
    return { ...base, type: 'datetime', value: '' }
  }
  if (valType === 'date') {
    return { ...base, type: 'date', value: '' }
  }

  return null
}

export function fieldsToArgs(
  fields: ReadonlyArray<ArgField>,
  original: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...original }

  for (const field of fields) {
    switch (field.type) {
      case 'boolean':
        out[field.key] = field.value
        break
      case 'number':
        out[field.key] = typeof field.value === 'number' ? field.value : Number(field.value)
        break
      case 'string-list':
        out[field.key] = String(field.value)
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        break
      case 'datetime':
        out[field.key] = datetimeLocalToIsoValue(
          String(field.value),
          typeof original[field.key] === 'string' ? String(original[field.key]) : undefined,
        )
        break
      default:
        out[field.key] = field.value
    }
  }

  return out
}

export function formatArgDisplayValue(field: ArgField): string {
  if (field.type === 'boolean') return field.value ? 'Yes' : 'No'
  if (field.type === 'string-list') {
    const lines = String(field.value)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    return lines.length > 0 ? lines.join(', ') : '—'
  }
  if (field.type === 'datetime') {
    const original = String(field.value)
    const parsed = Date.parse(original.includes('T') ? original : `${original}:00`)
    if (!Number.isNaN(parsed)) {
      return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(parsed)
    }
  }
  if (field.type === 'date') {
    const parsed = Date.parse(String(field.value))
    if (!Number.isNaN(parsed)) {
      return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(parsed)
    }
  }
  const text = String(field.value)
  return text.length > 0 ? text : '—'
}

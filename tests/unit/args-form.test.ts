import { describe, expect, it } from 'vitest'
import {
  argsToFields,
  datetimeLocalToIsoValue,
  fieldsToArgs,
  formatArgFieldLabel,
  inferFieldType,
  isoToDatetimeLocalValue,
  schemaToFields,
} from '@/lib/display/args-form'

describe('formatArgFieldLabel', () => {
  it('formats snake_case keys', () => {
    expect(formatArgFieldLabel('content_type')).toBe('Content type')
    expect(formatArgFieldLabel('recipient')).toBe('Recipient')
    expect(formatArgFieldLabel('start_datetime')).toBe('Start datetime')
  })
})

describe('inferFieldType', () => {
  it('detects common field shapes', () => {
    expect(inferFieldType('body', 'Hi\nthere')).toBe('text')
    expect(inferFieldType('recipient', 'a@b.com')).toBe('email')
    expect(inferFieldType('add_google_meet', true)).toBe('boolean')
    expect(inferFieldType('attendee_emails', ['a@b.com'])).toBe('string-list')
    expect(inferFieldType('start_datetime', '2026-05-23T10:00:00-05:00')).toBe('datetime')
    expect(inferFieldType('content_type', 'plain')).toBe('select')
    expect(inferFieldType('summary', 'Design follow-up')).toBe('string')
    expect(inferFieldType('nested', { foo: 'bar' })).toBe('unsupported')
  })
})

describe('datetime conversion', () => {
  it('round-trips datetime-local with original offset', () => {
    const original = '2026-05-23T10:30:00-05:00'
    const local = isoToDatetimeLocalValue(original)
    expect(local).toBe('2026-05-23T10:30')
    expect(datetimeLocalToIsoValue('2026-05-23T11:00', original)).toBe('2026-05-23T11:00:00-05:00')
  })
})

describe('argsToFields', () => {
  it('builds fields for flat gmail args', () => {
    const fields = argsToFields({
      recipient: 'a@example.com',
      subject: 'Hello',
      body: 'Line one\nLine two',
      content_type: 'plain',
    })
    expect(fields).not.toBeNull()
    expect(fields?.find((f) => f.key === 'recipient')?.type).toBe('email')
    expect(fields?.find((f) => f.key === 'content_type')?.type).toBe('select')
    expect(fields?.find((f) => f.key === 'body')?.type).toBe('text')
  })

  it('builds datetime fields for calendar args', () => {
    const fields = argsToFields({
      summary: 'Design Review Follow-up',
      start_datetime: '2026-05-23T10:00:00-05:00',
      end_datetime: '2026-05-23T10:30:00-05:00',
      calendar_id: 'primary',
    })
    expect(fields).not.toBeNull()
    expect(fields?.find((f) => f.key === 'start_datetime')?.type).toBe('datetime')
    expect(fields?.find((f) => f.key === 'summary')?.type).toBe('string')
  })

  it('returns null for nested args', () => {
    expect(argsToFields({ meta: { nested: true } })).toBeNull()
  })
})

describe('schemaToFields', () => {
  it('builds empty fields from Arcade tool input parameters', () => {
    const fields = schemaToFields({
      parameters: [
        {
          name: 'recipient',
          required: true,
          description: 'Email recipient.',
          value_schema: { val_type: 'string' },
        },
        {
          name: 'content_type',
          value_schema: { val_type: 'string', enum: ['plain', 'html'] },
        },
        {
          name: 'attendee_emails',
          value_schema: { val_type: 'array', inner_val_type: 'string' },
        },
      ],
    })

    expect(fields).not.toBeNull()
    expect(fields?.find((f) => f.key === 'recipient')).toMatchObject({
      type: 'email',
      required: true,
      description: 'Email recipient.',
    })
    expect(fields?.find((f) => f.key === 'content_type')).toMatchObject({
      type: 'select',
      options: ['plain', 'html'],
      value: 'plain',
    })
    expect(fields?.find((f) => f.key === 'attendee_emails')?.type).toBe('string-list')
  })

  it('returns null for unsupported complex parameter types', () => {
    expect(
      schemaToFields({
        parameters: [{ name: 'payload', value_schema: { val_type: 'object' } }],
      }),
    ).toBeNull()
  })

  it('attaches entity resolver metadata for Google Calendar calendar_id', () => {
    const fields = schemaToFields(
      {
        parameters: [
          {
            name: 'calendar_id',
            required: false,
            value_schema: { val_type: 'string' },
          },
        ],
      },
      { toolName: 'GoogleCalendar.CreateEvent@3.3.2' },
    )
    expect(fields?.find((field) => field.key === 'calendar_id')?.resolver).toMatchObject({
      id: 'google-calendar-calendar-id',
      toolkitName: 'GoogleCalendar',
    })
  })

  it('does not attach resolver metadata for unrelated tools', () => {
    const fields = schemaToFields(
      {
        parameters: [
          {
            name: 'calendar_id',
            required: false,
            value_schema: { val_type: 'string' },
          },
        ],
      },
      { toolName: 'Gmail.SendEmail@7.0.0' },
    )
    expect(fields?.find((field) => field.key === 'calendar_id')?.resolver).toBeUndefined()
  })
})

describe('fieldsToArgs', () => {
  it('round-trips edited values', () => {
    const original = {
      recipient: 'a@example.com',
      subject: 'Hello',
      attendee_emails: ['a@example.com'],
      add_google_meet: true,
      start_datetime: '2026-05-23T10:00:00-05:00',
    }
    const fields = argsToFields(original)
    expect(fields).not.toBeNull()
    if (!fields) return

    const edited = fields.map((field) => {
      if (field.key === 'subject') return { ...field, value: 'Updated subject' }
      if (field.key === 'start_datetime') return { ...field, value: '2026-05-23T11:00' }
      return field
    })
    expect(fieldsToArgs(edited, original)).toEqual({
      ...original,
      subject: 'Updated subject',
      start_datetime: '2026-05-23T11:00:00-05:00',
    })
  })
})

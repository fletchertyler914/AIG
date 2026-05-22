import { NextResponse } from 'next/server'
import type { z } from 'zod'

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init)
}

export function jsonError(message: string, status = 400): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status })
}

export function parseJson<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value)
}

export function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
  return NextResponse.json({
    ok: true,
    service: 'aig',
    timestamp: new Date().toISOString(),
  })
}

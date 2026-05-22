import { describe, expect, it } from 'vitest'
import { authorizeMany } from '@/lib/arcade/authorize'
import { getArcadeClient } from '@/lib/arcade/client'
import { personalArcadeIdentity, toArcadeUserId } from '@/lib/arcade/identity'
import { executeArcadeTool } from '@/lib/arcade/tools'
import { env } from '@/lib/env'

const runLive = process.env['RUN_ARCADE_INTEGRATION'] === '1'
const liveDescribe = runLive ? describe : describe.skip

const WRITE_TOOLS = ['Gmail.SendEmail@7.0.0', 'GoogleCalendar.CreateEvent@3.3.2'] as const
const READONLY_TOOL = 'Gmail.WhoAmI@7.0.0'
const DEMO_ARCADE_ID = toArcadeUserId(personalArcadeIdentity('demo'))
const DEMO_ARCADE_IDENTITY = personalArcadeIdentity('demo')

interface JsonRpcResponse {
  jsonrpc?: string
  id?: number | string
  result?: unknown
  error?: unknown
}

function gatewayUrl(): string | undefined {
  return env.ARCADE_MCP_GATEWAY_URL ?? process.env['ARCADE_MCP_GATEWAY_URL']
}

function mcpBearerToken(): string | undefined {
  return (
    env.ARCADE_MCP_AUTH_TOKEN ??
    process.env['ARCADE_MCP_AUTH_TOKEN'] ??
    env.ARCADE_API_KEY ??
    process.env['ARCADE_API_KEY']
  )
}

function buildMcpHeaders(token: string, sessionId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    'Arcade-User-ID': env.DEMO_USER_ID,
  }
  if (sessionId) headers['Mcp-Session-Id'] = sessionId
  return headers
}

interface McpCallResponse {
  status: number
  text: string
  sessionId: string | null
}

async function callMcp(
  url: string,
  body: Record<string, unknown>,
  token: string,
  sessionId?: string,
): Promise<McpCallResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: buildMcpHeaders(token, sessionId),
    body: JSON.stringify(body),
  })
  return {
    status: response.status,
    text: await response.text(),
    sessionId: response.headers.get('mcp-session-id'),
  }
}

function parseJsonOrSse(text: string): JsonRpcResponse {
  const trimmed = text.trim()
  if (trimmed.startsWith('event:') || trimmed.startsWith('data:')) {
    const dataLine = trimmed
      .split('\n')
      .find((line) => line.startsWith('data:'))
      ?.slice('data:'.length)
      .trim()
    return dataLine ? (JSON.parse(dataLine) as JsonRpcResponse) : {}
  }
  return JSON.parse(trimmed) as JsonRpcResponse
}

liveDescribe('Arcade live integration', () => {
  it('loads real formatted and canonical Arcade tools for the demo user', async () => {
    const arcade = getArcadeClient()

    const [formatted, canonical] = await Promise.all([
      arcade.tools.formatted.list({
        format: 'anthropic',
        user_id: env.DEMO_USER_ID,
        toolkit: 'Gmail',
        limit: 25,
      }),
      arcade.tools.list({
        user_id: env.DEMO_USER_ID,
        toolkit: 'Gmail',
        limit: 25,
      }),
    ])

    expect(formatted.items.length).toBeGreaterThan(0)
    expect(canonical.items.length).toBeGreaterThan(0)
    expect(formatted.items.some((tool) => tool['name'] === 'Gmail_SendEmail')).toBe(true)
    expect(canonical.items.some((tool) => tool.fully_qualified_name === WRITE_TOOLS[0])).toBe(true)
  })

  it('checks real Arcade OAuth status for write tools without executing them', async () => {
    const statuses = await authorizeMany(WRITE_TOOLS, DEMO_ARCADE_IDENTITY)

    expect(statuses).toHaveLength(WRITE_TOOLS.length)
    for (const status of statuses) {
      expect(WRITE_TOOLS).toContain(status.tool as (typeof WRITE_TOOLS)[number])
      expect(['completed', 'pending', 'not_started', 'failed', 'unknown']).toContain(status.status)
      if (status.status !== 'completed') {
        expect(status.url).toMatch(/^https:\/\//)
      }
    }
  })

  it('can execute a real read-only Arcade tool when explicitly enabled and authorized', async () => {
    if (process.env['RUN_ARCADE_READONLY_EXECUTION'] !== '1') {
      return
    }

    const [auth] = await authorizeMany([READONLY_TOOL], DEMO_ARCADE_IDENTITY)
    expect(auth).toBeDefined()
    if (auth?.status !== 'completed') {
      throw new Error(
        `${READONLY_TOOL} is not authorized for ${DEMO_ARCADE_ID}; authorize it first: ${auth?.url ?? 'no OAuth URL returned'}`,
      )
    }

    const result = await executeArcadeTool({
      tool: READONLY_TOOL,
      args: {},
      userId: DEMO_ARCADE_ID,
    })

    expect(result.success).not.toBe(false)
    expect(result.output).toBeDefined()
  })

  it('initializes and lists tools on the live Arcade MCP gateway', async () => {
    const url = gatewayUrl()
    if (!url) {
      throw new Error('Set ARCADE_MCP_GATEWAY_URL to run the live MCP gateway integration test')
    }
    const token = mcpBearerToken()
    if (!token) {
      throw new Error(
        'No bearer token available for MCP gateway — set ARCADE_API_KEY or ARCADE_MCP_AUTH_TOKEN',
      )
    }

    const init = await callMcp(
      url,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'aig-live-integration', version: '0.1.0' },
        },
      },
      token,
    )
    expect(init.status).toBe(200)
    const initBody = parseJsonOrSse(init.text)
    expect(initBody.result).toBeDefined()
    expect(init.sessionId).toBeTruthy()
    const sessionId = init.sessionId as string

    // MCP protocol requires the initialized notification before further calls.
    await callMcp(
      url,
      { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
      token,
      sessionId,
    )

    const list = await callMcp(
      url,
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      token,
      sessionId,
    )
    expect(list.status).toBe(200)
    const listBody = parseJsonOrSse(list.text)
    const result = listBody.result as { tools?: Array<{ name?: string }> } | undefined
    expect(Array.isArray(result?.tools)).toBe(true)
    expect((result?.tools ?? []).length).toBeGreaterThan(0)
  })

  it('rejects MCP gateway requests with no bearer token', async () => {
    const url = gatewayUrl()
    if (!url) {
      throw new Error('Set ARCADE_MCP_GATEWAY_URL to run the live MCP gateway integration test')
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'aig-no-auth', version: '0.1.0' },
        },
      }),
    })

    expect(response.status).toBe(401)
  })
})

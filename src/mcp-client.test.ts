import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('mcp-client', () => {
  const envKeys = [
    'MADE_REFINE_MCP_BOOTSTRAP_URL',
    'VITE_MADE_REFINE_MCP_BOOTSTRAP_URL',
    'NEXT_PUBLIC_MADE_REFINE_MCP_BOOTSTRAP_URL',
    'MADE_REFINE_VERSION',
    'VITE_MADE_REFINE_VERSION',
    'NEXT_PUBLIC_MADE_REFINE_VERSION',
  ] as const

  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
    delete window.__MADE_REFINE_CONFIG__
    delete window.__MADE_REFINE_MCP_BOOTSTRAP_URL__
    for (const key of envKeys) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.__MADE_REFINE_CONFIG__
    delete window.__MADE_REFINE_MCP_BOOTSTRAP_URL__
    for (const key of envKeys) {
      delete process.env[key]
    }
  })

  it('bootstraps via runtime config and sends edits to ingest endpoint', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          protocolVersion: 1,
          ingestBaseUrl: 'http://127.0.0.1:9002',
          accessToken: 'token-1',
          sessionId: 'session-1',
          projectId: 'project-1',
          expiresAt: '2999-01-01T00:00:00.000Z',
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, id: 'edit-1' }))

    window.__MADE_REFINE_CONFIG__ = {
      mcp: {
        bootstrapUrl: 'http://127.0.0.1:9001/v1/bootstrap',
        workspaceId: 'workspace-1',
        projectFingerprint: {
          path: '/repo/app',
          gitRemoteHash: 'git-hash-1',
        },
        clientVersion: '0.2.0-test',
      },
    }

    const { sendEditToAgent } = await import('./mcp-client')
    const result = await sendEditToAgent({ change: 'padding-top: 10px' })

    expect(result).toEqual({ ok: true, id: 'edit-1' })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [bootstrapUrl, bootstrapInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(bootstrapUrl).toBe('http://127.0.0.1:9001/v1/bootstrap')
    expect(bootstrapInit.method).toBe('POST')
    const bootstrapBody = JSON.parse(String(bootstrapInit.body)) as {
      protocolVersion: number
      workspaceId?: string
      projectFingerprint: {
        path: string
        gitRemoteHash: string | null
      }
      client: {
        name: string
        version: string
      }
    }
    expect(bootstrapBody.protocolVersion).toBe(1)
    expect(bootstrapBody.workspaceId).toBe('workspace-1')
    expect(bootstrapBody.projectFingerprint).toEqual({
      path: '/repo/app',
      gitRemoteHash: 'git-hash-1',
    })
    expect(bootstrapBody.client.name).toBe('made-refine')
    expect(bootstrapBody.client.version).toBe('0.2.0-test')

    const [editUrl, editInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(editUrl).toBe('http://127.0.0.1:9002/v1/annotations/edit')
    expect(editInit.method).toBe('POST')
    expect(editInit.body).toBe(JSON.stringify({ change: 'padding-top: 10px' }))

    const editHeaders = editInit.headers as Record<string, string>
    expect(editHeaders.Authorization).toBe('Bearer token-1')
    expect(editHeaders['X-Idempotency-Key']).toBeTruthy()
    expect(editHeaders['Content-Type']).toBe('application/json')
  })

  it('prefers runtime bootstrap global over env fallback', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        protocolVersion: 1,
        ingestBaseUrl: 'http://127.0.0.1:9052',
        accessToken: 'token-global',
      })
    )

    window.__MADE_REFINE_MCP_BOOTSTRAP_URL__ = 'http://127.0.0.1:9051'
    process.env.MADE_REFINE_MCP_BOOTSTRAP_URL = 'http://127.0.0.1:9059'

    const { checkAgentConnection } = await import('./mcp-client')
    const connected = await checkAgentConnection()

    expect(connected).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:9051/v1/bootstrap')
  })

  it('refreshes token on auth failure and retries once with same idempotency key', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          protocolVersion: 1,
          ingestBaseUrl: 'http://127.0.0.1:9102',
          accessToken: 'stale-token',
          sessionId: 'session-2',
          projectId: 'project-2',
          expiresAt: '2999-01-01T00:00:00.000Z',
        })
      )
      .mockResolvedValueOnce(jsonResponse(401, { ok: false }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, id: 'comment-1' }))

    window.__MADE_REFINE_CONFIG__ = {
      mcp: {
        bootstrapUrl: 'http://127.0.0.1:9101',
      },
    }

    const { sendCommentToAgent } = await import('./mcp-client')
    const result = await sendCommentToAgent({ comment: 'looks good' })

    expect(result).toEqual({ ok: true, id: 'comment-1' })
    expect(fetchMock).toHaveBeenCalledTimes(4)

    const [firstSendUrl, firstSendInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(firstSendUrl).toBe('http://127.0.0.1:9102/v1/annotations/comment')
    const firstSendHeaders = firstSendInit.headers as Record<string, string>
    expect(firstSendHeaders.Authorization).toBe('Bearer stale-token')

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(refreshUrl).toBe('http://127.0.0.1:9102/v1/sessions/refresh')
    const refreshHeaders = refreshInit.headers as Record<string, string>
    expect(refreshHeaders.Authorization).toBe('Bearer stale-token')

    const [retrySendUrl, retrySendInit] = fetchMock.mock.calls[3] as [string, RequestInit]
    expect(retrySendUrl).toBe('http://127.0.0.1:9102/v1/annotations/comment')
    const retryHeaders = retrySendInit.headers as Record<string, string>
    expect(retryHeaders.Authorization).toBe('Bearer fresh-token')
    expect(retryHeaders['X-Idempotency-Key']).toBe(firstSendHeaders['X-Idempotency-Key'])
  })

  it('uses env fallback when runtime config is not injected', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        protocolVersion: 1,
        ingestBaseUrl: 'http://127.0.0.1:9202',
        accessToken: 'token-3',
      })
    )

    process.env.VITE_MADE_REFINE_MCP_BOOTSTRAP_URL = 'http://127.0.0.1:9201'

    const { checkAgentConnection } = await import('./mcp-client')
    const connected = await checkAgentConnection()

    expect(connected).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:9201/v1/bootstrap')
  })

  it('rejects non-loopback bootstrap URLs before fetching', async () => {
    const fetchMock = vi.mocked(fetch)
    window.__MADE_REFINE_MCP_BOOTSTRAP_URL__ = 'https://example.com/bootstrap'

    const { checkAgentConnection } = await import('./mcp-client')
    const connected = await checkAgentConnection()

    expect(connected).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports offline when no bootstrap endpoint is available', async () => {
    const fetchMock = vi.mocked(fetch)

    const { checkAgentConnection } = await import('./mcp-client')
    const connected = await checkAgentConnection()

    expect(connected).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects bootstrap responses with mismatched protocol version', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        protocolVersion: 999,
        ingestBaseUrl: 'http://127.0.0.1:9302',
        accessToken: 'token-4',
      })
    )

    window.__MADE_REFINE_CONFIG__ = {
      mcp: {
        bootstrapUrl: 'http://127.0.0.1:9301',
      },
    }

    const { checkAgentConnection } = await import('./mcp-client')
    const connected = await checkAgentConnection()

    expect(connected).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects non-loopback ingest URLs from bootstrap', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        protocolVersion: 1,
        ingestBaseUrl: 'https://example.com',
        accessToken: 'token-5',
      })
    )

    window.__MADE_REFINE_CONFIG__ = {
      mcp: {
        bootstrapUrl: 'http://127.0.0.1:9401',
      },
    }

    const { checkAgentConnection } = await import('./mcp-client')
    const connected = await checkAgentConnection()

    expect(connected).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('forces a live bootstrap check for connection status', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          protocolVersion: 1,
          ingestBaseUrl: 'http://127.0.0.1:9502',
          accessToken: 'token-6',
          expiresAt: '2999-01-01T00:00:00.000Z',
        })
      )
      .mockResolvedValueOnce(jsonResponse(503, { ok: false }))
      .mockResolvedValueOnce(jsonResponse(503, { ok: false }))
      .mockResolvedValueOnce(jsonResponse(503, { ok: false }))

    window.__MADE_REFINE_CONFIG__ = {
      mcp: {
        bootstrapUrl: 'http://127.0.0.1:9501',
      },
    }

    const { checkAgentConnection } = await import('./mcp-client')
    await expect(checkAgentConnection()).resolves.toBe(true)
    await expect(checkAgentConnection()).resolves.toBe(false)
    // 1 for the first successful call + 3 for the second call (1 initial + 2 retries on 503)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})

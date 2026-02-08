const MCP_BASE = 'http://127.0.0.1:4747'

let cachedToken: string | null = null

async function getSessionToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && cachedToken) return cachedToken
  try {
    const res = await fetch(`${MCP_BASE}/api/health`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return null
    const data = await res.json()
    cachedToken = typeof data.sessionToken === 'string' ? data.sessionToken : null
    return cachedToken
  } catch {
    return null
  }
}

async function postWithSessionToken(
  path: '/api/edit' | '/api/comment',
  payload: Record<string, unknown>
): Promise<{ ok: boolean; id: string }> {
  const send = async (token: string | null) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['X-Session-Token'] = token
    return fetch(`${MCP_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  }

  let token = await getSessionToken()
  let res = await send(token)

  if (res.status === 403) {
    cachedToken = null
    token = await getSessionToken(true)
    res = await send(token)
  }

  return res.json()
}

export async function sendEditToAgent(
  edit: Record<string, unknown>
): Promise<{ ok: boolean; id: string }> {
  return postWithSessionToken('/api/edit', edit)
}

export async function sendCommentToAgent(
  comment: Record<string, unknown>
): Promise<{ ok: boolean; id: string }> {
  return postWithSessionToken('/api/comment', comment)
}

export async function checkAgentConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${MCP_BASE}/api/health`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return false
    const data = await res.json()
    cachedToken = typeof data.sessionToken === 'string' ? data.sessionToken : null
    return data.ok === true
  } catch {
    return false
  }
}

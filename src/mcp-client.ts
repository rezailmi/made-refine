const PROTOCOL_VERSION = 1
const BOOTSTRAP_TIMEOUT_MS = 2_500
const REQUEST_TIMEOUT_MS = 3_000
const SESSION_EXPIRY_SKEW_MS = 5_000
const CLIENT_NAME = 'made-refine'
const DEFAULT_CLIENT_VERSION = 'unknown'

const BOOTSTRAP_ENV_KEYS = [
  'MADE_REFINE_MCP_BOOTSTRAP_URL',
  'VITE_MADE_REFINE_MCP_BOOTSTRAP_URL',
  'NEXT_PUBLIC_MADE_REFINE_MCP_BOOTSTRAP_URL',
] as const

const CLIENT_VERSION_ENV_KEYS = [
  'MADE_REFINE_VERSION',
  'VITE_MADE_REFINE_VERSION',
  'NEXT_PUBLIC_MADE_REFINE_VERSION',
] as const

type BootstrapEnvKey = (typeof BOOTSTRAP_ENV_KEYS)[number]
type ClientVersionEnvKey = (typeof CLIENT_VERSION_ENV_KEYS)[number]
type EnvKey = BootstrapEnvKey | ClientVersionEnvKey

type AnnotationPath = '/v1/annotations/edit' | '/v1/annotations/comment'

interface KnownProcessEnv {
  MADE_REFINE_MCP_BOOTSTRAP_URL?: string
  VITE_MADE_REFINE_MCP_BOOTSTRAP_URL?: string
  NEXT_PUBLIC_MADE_REFINE_MCP_BOOTSTRAP_URL?: string
  MADE_REFINE_VERSION?: string
  VITE_MADE_REFINE_VERSION?: string
  NEXT_PUBLIC_MADE_REFINE_VERSION?: string
  [key: string]: string | undefined
}

declare const process: { env?: KnownProcessEnv } | undefined

interface RuntimeMcpConfig {
  bootstrapUrl?: string
  workspaceId?: string
  projectFingerprint?: {
    path?: string
    gitRemoteHash?: string
  }
  clientVersion?: string
}

interface RuntimeConfig {
  mcp?: RuntimeMcpConfig
  mcpBootstrapUrl?: string
}

interface SessionContext {
  bootstrapUrl: string
  ingestBaseUrl: string
  serverInstanceId: string | null
  projectId: string | null
  sessionId: string | null
  accessToken: string | null
  expiresAt: number | null
}

interface BootstrapRequest {
  protocolVersion: number
  projectFingerprint: {
    path: string
    gitRemoteHash: string | null
  }
  workspaceId?: string
  client: {
    name: string
    version: string
    origin: string | null
  }
}

declare global {
  interface Window {
    __MADE_REFINE_CONFIG__?: RuntimeConfig
    __MADE_REFINE_MCP_BOOTSTRAP_URL__?: string
  }
}

let cachedSession: SessionContext | null = null

function getTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  const timeout = (AbortSignal as { timeout?: (delay: number) => AbortSignal }).timeout
  return typeof timeout === 'function' ? timeout(timeoutMs) : undefined
}

function getRuntimeMcpConfig(): RuntimeMcpConfig | null {
  if (typeof window === 'undefined') return null
  const config = window.__MADE_REFINE_CONFIG__
  const bootstrapUrl =
    config?.mcp?.bootstrapUrl
    ?? config?.mcpBootstrapUrl
    ?? window.__MADE_REFINE_MCP_BOOTSTRAP_URL__

  if (!config?.mcp && typeof bootstrapUrl !== 'string') return null
  return {
    ...(config?.mcp ?? {}),
    ...(typeof bootstrapUrl === 'string' ? { bootstrapUrl } : {}),
  }
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getStaticProcessEnvValue(key: EnvKey): string | null {
  switch (key) {
    case 'MADE_REFINE_MCP_BOOTSTRAP_URL':
      return toNonEmptyString(typeof process !== 'undefined' ? process.env?.MADE_REFINE_MCP_BOOTSTRAP_URL : undefined)
    case 'VITE_MADE_REFINE_MCP_BOOTSTRAP_URL':
      return toNonEmptyString(typeof process !== 'undefined' ? process.env?.VITE_MADE_REFINE_MCP_BOOTSTRAP_URL : undefined)
    case 'NEXT_PUBLIC_MADE_REFINE_MCP_BOOTSTRAP_URL':
      return toNonEmptyString(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_MADE_REFINE_MCP_BOOTSTRAP_URL : undefined)
    case 'MADE_REFINE_VERSION':
      return toNonEmptyString(typeof process !== 'undefined' ? process.env?.MADE_REFINE_VERSION : undefined)
    case 'VITE_MADE_REFINE_VERSION':
      return toNonEmptyString(typeof process !== 'undefined' ? process.env?.VITE_MADE_REFINE_VERSION : undefined)
    case 'NEXT_PUBLIC_MADE_REFINE_VERSION':
      return toNonEmptyString(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_MADE_REFINE_VERSION : undefined)
    default:
      return null
  }
}

function getDynamicProcessEnvValue(keys: readonly EnvKey[]): string | null {
  const processLike = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  const env = processLike?.env
  if (!env) return null

  for (const key of keys) {
    const value = toNonEmptyString(env[key])
    if (value) return value
  }

  return null
}

function getEnvValue(keys: readonly EnvKey[]): string | null {
  for (const key of keys) {
    const processValue = getStaticProcessEnvValue(key)
    if (processValue) return processValue
  }

  return getDynamicProcessEnvValue(keys)
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '')
  }

  if (typeof window === 'undefined' || !window.location?.origin) return null
  try {
    return new URL(trimmed, window.location.origin).toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

function normalizeBootstrapUrl(value: string | null | undefined): string | null {
  const normalized = normalizeUrl(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    url.pathname = normalizedPathname.endsWith('/v1/bootstrap')
      ? normalizedPathname
      : `${normalizedPathname}/v1/bootstrap`
    return url.toString()
  } catch {
    return normalized.endsWith('/v1/bootstrap') ? normalized : `${normalized}/v1/bootstrap`
  }
}

function toSafeBootstrapUrl(value: string | null | undefined): string | null {
  const normalized = normalizeBootstrapUrl(value)
  if (!normalized) return null
  return isLoopbackHttpUrl(normalized) ? normalized : null
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseExpiresAt(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function readNumber(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function isLoopbackIpv4(hostname: string): boolean {
  if (!/^127(?:\.\d{1,3}){3}$/.test(hostname)) return false
  const segments = hostname.split('.')
  return segments.every((segment) => {
    const value = Number(segment)
    return Number.isInteger(value) && value >= 0 && value <= 255
  })
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (hostname === '::1' || hostname === '[::1]') return true
  return isLoopbackIpv4(hostname)
}

function isLoopbackHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return isLoopbackHostname(url.hostname)
  } catch {
    return false
  }
}

function buildBootstrapRequestBody(runtimeConfig: RuntimeMcpConfig | null): BootstrapRequest {
  const locationPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const locationOrigin = typeof window !== 'undefined' ? window.location.origin : null

  return {
    protocolVersion: PROTOCOL_VERSION,
    projectFingerprint: {
      path: runtimeConfig?.projectFingerprint?.path || locationPath || 'unknown',
      gitRemoteHash: runtimeConfig?.projectFingerprint?.gitRemoteHash ?? null,
    },
    ...(runtimeConfig?.workspaceId
      ? {
          workspaceId: runtimeConfig.workspaceId,
        }
      : {}),
    client: {
      name: CLIENT_NAME,
      version: runtimeConfig?.clientVersion
        ?? getEnvValue(CLIENT_VERSION_ENV_KEYS)
        ?? DEFAULT_CLIENT_VERSION,
      origin: locationOrigin,
    },
  }
}

function resolveBootstrapUrl(): string | null {
  const runtimeConfig = getRuntimeMcpConfig()
  const runtimeUrl = toSafeBootstrapUrl(runtimeConfig?.bootstrapUrl)
  if (runtimeUrl) return runtimeUrl

  const envUrl = toSafeBootstrapUrl(getEnvValue(BOOTSTRAP_ENV_KEYS))
  if (envUrl) return envUrl

  return null
}

function isSessionUsable(session: SessionContext | null, bootstrapUrl: string): session is SessionContext {
  if (!session) return false
  if (session.bootstrapUrl !== bootstrapUrl) return false
  if (session.expiresAt == null) return true
  return Date.now() < session.expiresAt - SESSION_EXPIRY_SKEW_MS
}

async function readJsonRecord(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const data = await response.json()
    if (!data || typeof data !== 'object') return null
    return data as Record<string, unknown>
  } catch {
    return null
  }
}

async function bootstrapSession(force = false): Promise<SessionContext | null> {
  const bootstrapUrl = resolveBootstrapUrl()
  if (!bootstrapUrl) {
    cachedSession = null
    return null
  }

  if (!force && isSessionUsable(cachedSession, bootstrapUrl)) {
    return cachedSession
  }

  const runtimeConfig = getRuntimeMcpConfig()
  try {
    const response = await fetch(bootstrapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBootstrapRequestBody(runtimeConfig)),
      signal: getTimeoutSignal(BOOTSTRAP_TIMEOUT_MS),
    })
    if (!response.ok) {
      cachedSession = null
      return null
    }

    const data = await readJsonRecord(response)
    const protocolVersion = readNumber(data, 'protocolVersion')
    if (protocolVersion !== PROTOCOL_VERSION) {
      cachedSession = null
      return null
    }

    const ingestBaseUrl = normalizeUrl(readString(data, 'ingestBaseUrl'))
    if (!ingestBaseUrl || !isLoopbackHttpUrl(ingestBaseUrl)) {
      cachedSession = null
      return null
    }

    const nextSession: SessionContext = {
      bootstrapUrl,
      ingestBaseUrl,
      serverInstanceId: readString(data, 'serverInstanceId'),
      projectId: readString(data, 'projectId'),
      sessionId: readString(data, 'sessionId'),
      accessToken: readString(data, 'accessToken'),
      expiresAt: parseExpiresAt(data?.expiresAt),
    }
    cachedSession = nextSession
    return nextSession
  } catch {
    cachedSession = null
    return null
  }
}

async function refreshSessionToken(session: SessionContext): Promise<SessionContext | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`
    }

    const response = await fetch(joinUrl(session.ingestBaseUrl, '/v1/sessions/refresh'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        projectId: session.projectId,
        sessionId: session.sessionId,
      }),
      signal: getTimeoutSignal(REQUEST_TIMEOUT_MS),
    })

    if (response.status === 404 || response.status === 405) {
      return null
    }
    if (!response.ok) {
      return null
    }

    const data = await readJsonRecord(response)
    const nextToken = readString(data, 'accessToken')
    if (!nextToken) {
      return null
    }

    const refreshedSession: SessionContext = {
      ...session,
      accessToken: nextToken,
      expiresAt: parseExpiresAt(data?.expiresAt) ?? session.expiresAt,
    }
    cachedSession = refreshedSession
    return refreshedSession
  } catch {
    return null
  }
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 12)
  return `${timestamp}-${random}`
}

async function sendAnnotationRequest(
  session: SessionContext,
  path: AnnotationPath,
  payload: Record<string, unknown>,
  idempotencyKey: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey,
  }

  if (session.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  return fetch(joinUrl(session.ingestBaseUrl, path), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: getTimeoutSignal(REQUEST_TIMEOUT_MS),
  })
}

async function toClientResponse(response: Response): Promise<{ ok: boolean; id: string }> {
  const data = await readJsonRecord(response)
  const bodyOk = data?.ok
  const parsedOk = typeof bodyOk === 'boolean' ? bodyOk : response.ok

  return {
    ok: parsedOk && response.ok,
    id: readString(data, 'id') ?? '',
  }
}

async function postWithSessionToken(
  path: AnnotationPath,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; id: string }> {
  const idempotencyKey = createIdempotencyKey()

  let session = await bootstrapSession()
  if (!session) return { ok: false, id: '' }

  let response: Response
  try {
    response = await sendAnnotationRequest(session, path, payload, idempotencyKey)
  } catch {
    return { ok: false, id: '' }
  }

  if (response.status === 401 || response.status === 403) {
    session = (await refreshSessionToken(session)) ?? (await bootstrapSession(true))
    if (!session) return { ok: false, id: '' }

    try {
      response = await sendAnnotationRequest(session, path, payload, idempotencyKey)
    } catch {
      return { ok: false, id: '' }
    }
  }

  return toClientResponse(response)
}

export async function sendEditToAgent(
  edit: Record<string, unknown>
): Promise<{ ok: boolean; id: string }> {
  return postWithSessionToken('/v1/annotations/edit', edit)
}

export async function sendCommentToAgent(
  comment: Record<string, unknown>
): Promise<{ ok: boolean; id: string }> {
  return postWithSessionToken('/v1/annotations/comment', comment)
}

export async function checkAgentConnection(): Promise<boolean> {
  const session = await bootstrapSession(true)
  return Boolean(session)
}

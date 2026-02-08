import http from 'node:http'
import crypto from 'node:crypto'
import { z } from 'zod'
import type { VisualAnnotation } from './types'
import { store } from './store'

const MAX_BODY_BYTES = 256 * 1024 // 256 KB

const ALLOWED_ORIGINS = new Set([
  'http://localhost',
  'http://127.0.0.1',
  'https://localhost',
  'https://127.0.0.1',
])

/** Match localhost origins with any port (e.g. http://localhost:3000) */
function isAllowedOrigin(origin: string | undefined): string | false {
  if (!origin) return false
  // Exact match (no port)
  if (ALLOWED_ORIGINS.has(origin)) return origin
  // Match with port
  try {
    const url = new URL(origin)
    const base = `${url.protocol}//${url.hostname}`
    if (ALLOWED_ORIGINS.has(base)) return origin
  } catch {
    // invalid origin
  }
  return false
}

// Per-session token generated on server start
const SESSION_TOKEN = crypto.randomUUID()

function corsHeaders(req: http.IncomingMessage): Record<string, string> {
  const origin = isAllowedOrigin(req.headers.origin)
  if (!origin) {
    return {}
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
    Vary: 'Origin',
  }
}

function json(
  res: http.ServerResponse,
  req: http.IncomingMessage,
  status: number,
  data: unknown
): void {
  res.writeHead(status, { ...corsHeaders(req), 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    let tooLarge = false
    req.on('data', (chunk: Buffer) => {
      if (tooLarge) return
      totalBytes += chunk.length
      if (totalBytes > MAX_BODY_BYTES) {
        tooLarge = true
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) {
        reject(new Error('Body too large'))
        return
      }
      resolve(Buffer.concat(chunks).toString())
    })
    req.on('error', reject)
  })
}

function hasValidToken(req: http.IncomingMessage): boolean {
  return req.headers['x-session-token'] === SESSION_TOKEN
}

// --- Zod schemas ---

const visualEditElementSchema = z.object({
  tagName: z.string(),
  id: z.string().nullable(),
  classList: z.array(z.string()),
  domSelector: z.string(),
  targetHtml: z.string().max(10_000),
  textPreview: z.string().max(1000),
})

const sourceLocationSchema = z.object({
  file: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
})

const reactComponentFrameSchema = z.object({
  name: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
})

const cssChangeSchema = z.object({
  cssProperty: z.string(),
  cssValue: z.string(),
  tailwindClass: z.string(),
})

const editPayloadSchema = z
  .object({
    element: visualEditElementSchema,
    source: sourceLocationSchema.nullable(),
    reactStack: z.array(reactComponentFrameSchema),
    changes: z.array(cssChangeSchema).min(1),
    exportMarkdown: z.string().max(50_000),
  })
  .strict()

const commentPayloadSchema = z
  .object({
    element: visualEditElementSchema,
    source: sourceLocationSchema.nullable(),
    reactStack: z.array(reactComponentFrameSchema),
    commentText: z.string().min(1).max(10_000),
    replies: z
      .array(z.object({ text: z.string().max(10_000), createdAt: z.number() }))
      .default([]),
    exportMarkdown: z.string().max(50_000),
  })
  .strict()

export function getSessionToken(): string {
  return SESSION_TOKEN
}

export function createHttpServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req))
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://localhost`)

    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, req, 200, {
        ok: true,
        pendingCount: store.getPending().length,
        sessionToken: SESSION_TOKEN,
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/annotations') {
      json(res, req, 200, { annotations: store.getAll() })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/edit') {
      if (!hasValidToken(req)) {
        json(res, req, 403, { ok: false, error: 'Invalid or missing session token' })
        return
      }
      try {
        const body = editPayloadSchema.parse(JSON.parse(await readBody(req)))
        const annotation: VisualAnnotation = {
          ...body,
          type: 'edit',
          status: 'pending',
          timestamp: Date.now(),
          id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }
        store.add(annotation)
        json(res, req, 200, { ok: true, id: annotation.id })
      } catch (err) {
        if (err instanceof z.ZodError) {
          json(res, req, 400, {
            ok: false,
            error: 'Validation failed',
            details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
          })
        } else if (err instanceof Error && err.message === 'Body too large') {
          json(res, req, 413, { ok: false, error: 'Payload too large' })
        } else {
          json(res, req, 400, { ok: false, error: 'Invalid JSON' })
        }
      }
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/comment') {
      if (!hasValidToken(req)) {
        json(res, req, 403, { ok: false, error: 'Invalid or missing session token' })
        return
      }
      try {
        const body = commentPayloadSchema.parse(JSON.parse(await readBody(req)))
        const annotation: VisualAnnotation = {
          ...body,
          type: 'comment',
          status: 'pending',
          timestamp: Date.now(),
          id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }
        store.add(annotation)
        json(res, req, 200, { ok: true, id: annotation.id })
      } catch (err) {
        if (err instanceof z.ZodError) {
          json(res, req, 400, {
            ok: false,
            error: 'Validation failed',
            details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
          })
        } else if (err instanceof Error && err.message === 'Body too large') {
          json(res, req, 413, { ok: false, error: 'Payload too large' })
        } else {
          json(res, req, 400, { ok: false, error: 'Invalid JSON' })
        }
      }
      return
    }

    json(res, req, 404, { error: 'Not found' })
  })

  return server
}

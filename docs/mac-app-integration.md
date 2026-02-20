# Mac App Integration Contract

The `made-refine` npm package is a browser overlay — it does not run a local server. Instead it expects a **local Mac app** (e.g. DirectCopy) to run an HTTP broker on loopback that receives annotations from the browser and routes them to agents via MCP.

This document describes the integration contract from `made-refine`'s perspective: what the overlay sends, what the Mac app must return, and what constraints apply.

## Architecture

Two paths converge on the same annotation store inside the Mac app:

```
Browser overlay ──── HTTP (loopback) ────► Mac app broker ◄──── MCP (stdio) ──── Agent
     │                                         │                                    │
  CSS edits &                           annotation store                   get_pending_edits
  comments                              (persistent)                       resolve_edit, etc.
```

The overlay posts annotations over HTTP. The agent pulls or watches them via MCP tools (see [MCP server](mcp-server.md)). Both sides read from the same store.

## Bootstrap URL configuration

The overlay resolves the Mac app's ingest URL dynamically — no port is hardcoded in the package. Resolution order:

1. **Runtime config** — `window.__MADE_REFINE_CONFIG__.mcp.bootstrapUrl` or `window.__MADE_REFINE_MCP_BOOTSTRAP_URL__`
2. **Environment variable** — framework-specific prefix:
   - `MADE_REFINE_MCP_BOOTSTRAP_URL`
   - `VITE_MADE_REFINE_MCP_BOOTSTRAP_URL`
   - `NEXT_PUBLIC_MADE_REFINE_MCP_BOOTSTRAP_URL`

The value must be a loopback URL (`localhost`, `127.x.x.x`, `::1`). Remote URLs are silently rejected.

The overlay normalizes the URL to ensure it ends with `/v1/bootstrap` before use.

## Bootstrap contract

On the first request (or after token expiry/rejection), the overlay calls `POST /v1/bootstrap`.

### Request

```json
{
  "protocolVersion": 1,
  "projectFingerprint": {
    "path": "/Users/alice/projects/my-app",
    "gitRemoteHash": "abc123" | null
  },
  "workspaceId": "optional-workspace-id",
  "client": {
    "name": "made-refine",
    "version": "0.2.1",
    "origin": "http://localhost:3000"
  }
}
```

`projectFingerprint.path` is the dev server's URL pathname (or an injected project root path). `gitRemoteHash` is a hash of the git remote URL used for stable project identity across machine renames.

### Response

```json
{
  "protocolVersion": 1,
  "ingestBaseUrl": "http://127.0.0.1:4747",
  "serverInstanceId": "instance-uuid",
  "projectId": "project-uuid",
  "sessionId": "session-uuid",
  "accessToken": "short-lived-token",
  "expiresAt": "2026-01-01T00:05:00Z"
}
```

The overlay validates:
- `protocolVersion` must be `1` (exact match)
- `ingestBaseUrl` must be a loopback HTTP/HTTPS URL

If either check fails, the session is discarded and the overlay goes offline silently.

## Annotation ingest

After bootstrap, the overlay POSTs edits and comments to the `ingestBaseUrl` returned by the Mac app.

### Edit — `POST /v1/annotations/edit`

Required headers:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
X-Idempotency-Key: <uuid>
```

Body:
```json
{
  "element": {
    "tagName": "div",
    "id": "hero",
    "classList": ["flex", "gap-4"],
    "domSelector": "main > section:nth-child(2) > div",
    "targetHtml": "<div class=\"flex gap-4\">...</div>",
    "textPreview": "Get started"
  },
  "source": { "fileName": "src/Hero.tsx", "lineNumber": 12, "columnNumber": 3 } | null,
  "reactStack": [
    { "name": "Hero", "fileName": "src/Hero.tsx", "lineNumber": 5 },
    { "name": "App", "fileName": "src/App.tsx", "lineNumber": 8 }
  ],
  "changes": [
    { "cssProperty": "padding-top", "cssValue": "24px", "tailwindClass": "pt-6" },
    { "cssProperty": "background-color", "cssValue": "#3b82f6", "tailwindClass": "bg-blue-500" }
  ],
  "textChange": { "originalText": "Get started", "newText": "Start now" } | null,
  "moveChange": { ... } | null,
  "exportMarkdown": "## Hero\n\n**Changes:**\n- `padding-top: 24px` → `pt-6`\n..."
}
```

### Comment — `POST /v1/annotations/comment`

Same headers. Body:
```json
{
  "element": { ... },
  "source": { ... } | null,
  "reactStack": [...],
  "commentText": "Make this section more prominent",
  "replies": [{ "text": "Agreed, maybe increase padding", "createdAt": 1700000000000 }],
  "exportMarkdown": "## Comment on Hero\n\n> Make this section more prominent\n..."
}
```

### Response

Both endpoints return:
```json
{ "ok": true, "id": "annotation-uuid" }
```

The `X-Idempotency-Key` header guarantees that a retry with the same key does not create a duplicate annotation.

## Token refresh

When the overlay receives `401` or `403`, it attempts `POST /v1/sessions/refresh` before re-bootstrapping.

### Request

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```
```json
{
  "protocolVersion": 1,
  "projectId": "project-uuid",
  "sessionId": "session-uuid"
}
```

### Response

```json
{ "accessToken": "new-token", "expiresAt": "2026-01-01T00:10:00Z" }
```

If this endpoint returns `404` or `405`, the overlay skips refresh and calls `/v1/bootstrap` again directly. Implementing this endpoint is optional but recommended for long-lived sessions.

## Token caching and expiry

The overlay caches the session in memory. It considers the token expired 5 seconds before `expiresAt` to avoid clock-skew edge cases. Requests use `AbortSignal.timeout`: 2.5 seconds for bootstrap, 3 seconds for annotation requests.

## Security requirements

The Mac app must enforce:

- **Loopback-only**: reject all non-loopback ingest connections
- **Origin + project binding**: validate that the `Authorization` token matches the `projectId` in the request
- **Short-lived tokens**: `expiresAt` should be in the near future (minutes, not days)
- **Idempotency enforcement**: use `X-Idempotency-Key` as a deduplication key per project/session

The overlay will never send annotations to a non-loopback `ingestBaseUrl` — it validates this on every bootstrap response.

## Offline behavior

If the Mac app is unreachable or returns an error at any step:

- The overlay silently fails the send and returns `ok: false` to the caller
- The panel and toolbar show a non-blocking "offline" indicator
- Local copy and export UX remains fully available (edits can be copied as markdown without the Mac app)
- The session cache is cleared; the next send attempt triggers a fresh bootstrap

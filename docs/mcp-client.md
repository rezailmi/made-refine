# MCP Client (`src/mcp-client.ts`)

The MCP client sends CSS edits and comments from the browser directly to an AI coding agent (e.g. Claude Code, Cursor) running locally. It communicates over HTTP to a local MCP server using a bootstrap/session protocol.

## Overview

The client exposes three public functions:

| Function | Purpose |
|---|---|
| `sendEditToAgent(edit)` | Send a CSS edit annotation to the agent |
| `sendCommentToAgent(comment)` | Send a comment annotation to the agent |
| `checkAgentConnection()` | Test whether an agent is reachable |

All three return `{ ok: boolean; id: string }` (or just `boolean` for `checkAgentConnection`).

## How it works

### 1. Bootstrap URL resolution

The client looks for the MCP server URL in this order:

1. **Runtime config** — `window.__MADE_REFINE_CONFIG__.mcp.bootstrapUrl` or `window.__MADE_REFINE_MCP_BOOTSTRAP_URL__`
2. **Environment variables** — checked with framework-appropriate prefixes:
   - `MADE_REFINE_MCP_BOOTSTRAP_URL`
   - `VITE_MADE_REFINE_MCP_BOOTSTRAP_URL`
   - `NEXT_PUBLIC_MADE_REFINE_MCP_BOOTSTRAP_URL`

The URL must point to a loopback address (`localhost`, `127.x.x.x`, `::1`) — remote URLs are rejected for security.

### 2. Session bootstrap

On the first request (or when the session expires), the client POSTs to `/v1/bootstrap` with:

- `protocolVersion` — currently `1`
- `projectFingerprint` — path and git remote hash to identify the project
- `workspaceId` — optional workspace identifier
- `client` — name (`made-refine`), version, and browser origin

The server responds with an `ingestBaseUrl`, `sessionId`, `accessToken`, and `expiresAt`. The session is cached in memory.

### 3. Sending annotations

Edits and comments are POSTed to the ingest server:

- **Edits** → `POST /v1/annotations/edit`
- **Comments** → `POST /v1/annotations/comment`

Each request includes an `Authorization: Bearer <token>` header and an `X-Idempotency-Key` for deduplication.

### 4. Token refresh

If a request gets a `401` or `403`, the client tries to refresh the token via `POST /v1/sessions/refresh`. If that fails, it re-bootstraps the full session.

## Security

- Only loopback URLs are accepted (`localhost`, `127.0.0.0/8`, `::1`) — the client will not send data to remote servers
- Tokens have an expiry with a 5-second skew buffer
- All requests use `AbortSignal.timeout` (bootstrap: 2.5s, other requests: 3s) to avoid hanging

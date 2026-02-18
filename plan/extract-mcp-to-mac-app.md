# Plan: Extract MCP Handling into the Mac App (Tauri + TS + React/TanStack Start)

## Goal

Move MCP server lifecycle and annotation state out of the `made-refine` npm package into the Mac app so we can:

1. Run one stable local service instead of spawning per-project MCP binaries.
2. Eliminate port collisions and workspace contention.
3. Centralize session routing, persistence, and git/apply flows in the desktop app.

## Migration Mode (Locked)

1. This plan assumes a **full migration** away from bundled MCP runtime in `made-refine`.
2. End state: MCP lifecycle is owned by the Mac app only.
3. `made-refine` becomes overlay/client + protocol only (no long-lived MCP server process).
4. No timeline-based planning is used; execution is milestone-gated only.

## Current State (in `made-refine`)

1. MCP stdio server + local HTTP bridge are bundled in package (`made-refine-mcp` bin).
2. HTTP bridge binds to fixed `127.0.0.1:4747` (`src/mcp/index.ts`).
3. Browser overlay posts edits/comments to fixed `http://127.0.0.1:4747` (`src/mcp-client.ts`).
4. Annotation store is in-memory only (`src/mcp/store.ts`), scoped to one process lifetime.

## Target State

1. **Mac app owns MCP service lifecycle**:
   - Runs one local “MCP broker” service at app startup.
   - Handles queueing/session state for all projects/workspaces.
2. **`made-refine` package becomes a thin client**:
   - Browser overlay sends annotations to broker endpoint (discoverable, not hardcoded).
   - No bundled MCP server process required for normal usage.
3. **Agent compatibility preserved**:
   - Claude/Cursor still connect via MCP (stdio or HTTP) but terminate at the broker layer.
4. **Git operations integrated**:
   - Broker emits “apply request” events to existing Mac app git workflow.

## Decisions for Full Migration

1. Local-first architecture (no cloud-hosted broker for core flows).
2. MCP transport remains stdio-first for Claude/Cursor compatibility.
3. Annotation persistence is local (SQLite) in app-managed storage.
4. Project identity uses both canonical absolute path and git remote fingerprint.
5. Status transitions are broker-authoritative; destructive/apply actions require user confirmation by default.
6. Ingest remains localhost-only by default; optional explicit allowlist for non-local dev domains.
7. `made-refine-mcp` is removed at cutover after app-managed MCP entrypoint is validated.
8. Trusted automation (auto apply/commit) is out of scope for initial cutover and can be added later behind explicit per-repo opt-in.

## How Package Still Communicates with MCP (Full Migration)

The package communicates with the **app-owned broker** through a local ingest API, while agents communicate through MCP transport to the same broker.

1. Overlay path:
   - `made-refine` in browser -> local app ingest API (`HTTP on loopback`) -> broker store/router.
2. Agent path:
   - Claude/Cursor MCP client -> app-owned stdio MCP entrypoint -> broker store/router.
3. Shared state:
   - Both paths converge on the same project/session-scoped annotation store in the Mac app.

## Package-to-App Communication Contract

1. `POST /v1/bootstrap`
   - Purpose: single control-plane handshake for discovery + session creation.
   - Request includes:
     - `protocolVersion`
     - `projectFingerprint` (path + git remote hash)
     - `workspaceId` (if present)
     - `client` metadata (`made-refine` version, origin)
   - Response includes:
     - `protocolVersion`
     - `ingestBaseUrl`
     - `serverInstanceId`
     - `projectId`
     - `sessionId`
     - `accessToken`
     - `expiresAt`
2. `POST /v1/annotations/edit`
3. `POST /v1/annotations/comment`
   - Purpose: ingest edits/comments with `Bearer` token + idempotency key.
4. `POST /v1/sessions/refresh` (optional)
   - Purpose: token rotation for long-lived sessions when needed.

## Bootstrap and Reconnect Flow

1. Overlay startup:
   - Resolve broker bootstrap endpoint from injected runtime config or env override.
   - Call `/v1/bootstrap`.
2. Normal send:
   - Send annotations with token + idempotency key.
3. Token expiry:
   - On `401/403`, call `/v1/sessions/refresh` (if enabled), retry once.
   - If refresh is unavailable, call `/v1/bootstrap` again.
4. App restart/disconnect:
   - Re-run `/v1/bootstrap`.
   - Queue unsent local edits briefly and flush on reconnect.
5. Hard failure:
   - Show non-blocking “MCP app offline” indicator in overlay.
   - Keep local copy/export UX available.

## Discovery Strategy (No Hardcoded Broker Port)

1. Do not hardcode broker ingest port in package.
2. Use a **bootstrap endpoint** that returns current ingest URL + session token.
3. Endpoint resolution order:
   - injected runtime config (preferred)
   - environment variable override (development/advanced use)
4. If fallback discovery is ever needed, require explicit app ownership proof before trusting responses.
5. Broker may use dynamic port/domain socket internally; package only needs bootstrap contract.

## Architecture Proposal

## Components

1. **Overlay Client (in `made-refine`)**
   - Sends `edit/comment` payloads + project/session metadata.
   - Reads broker bootstrap endpoint from runtime config/env and obtains URL/token via `/v1/bootstrap`.

2. **Tauri Backend (Rust core + TS bridge)**
   - Starts local broker.
   - Maintains project/session registry.
   - Persists annotations (SQLite or lightweight JSON db).
   - Exposes app commands/events to React UI.

3. **MCP Broker Service**
   - Implements tool surface currently in `src/mcp/server.ts`.
   - Routes tool calls by project/session.
   - Returns export payloads and status updates.

4. **Mac App UI (React + TanStack Start)**
   - Session dashboard: pending/ack/applied/dismissed.
   - Connects annotations to existing git/apply flow.
   - Optional: live watch stream for incoming overlay edits.

## Process Model Decision

1. **Migration implementation**: Start with a TypeScript broker sidecar launched by Tauri for fastest parity with current MCP behavior.
2. **Final architecture**: Fold broker core into Tauri backend (Rust) after feature parity and protocol stability.
3. **Why this split**:
   - Low-risk path to ship full migration quickly.
   - Keeps long-term target as single-runtime app-owned service.

## Tauri MCP Best Practices (Required)

1. App-owned lifecycle:
   - MCP broker is started/stopped by Tauri, not by project scripts.
   - Add health checks and automatic restart on broker crash.
2. Transport strategy:
   - Keep MCP client-facing transport stdio-first for Claude/Cursor compatibility.
   - Use local-only ingest transport between overlay and app (`127.0.0.1` or domain socket).
3. No hardcoded ports:
   - Use dynamic port allocation (or domain socket path) and discovery via app API.
   - Reject startup if another stale instance claims the same identity.
4. Strict schema validation:
   - Validate all ingress payloads against shared protocol schemas.
   - Treat unknown fields as invalid unless explicitly versioned.
5. Strong local auth:
   - Mint scoped, short-lived session tokens bound to project/session identity.
   - Enforce origin + token checks on ingest endpoints.
6. Durable persistence:
   - Use SQLite with WAL mode and explicit migrations.
   - Persist annotations, sessions, and state transitions.
7. Multi-project isolation:
   - Route by `projectId` + `sessionId`; never mix annotation queues across projects.
8. Idempotent tool behavior:
   - Status updates and apply operations must be safe to retry.
   - Support cancellation/timeouts for long-running tools.
9. Observability:
   - Structured logs with correlation IDs (project/session/tool call id).
   - Dedicated diagnostics command in app UI for MCP status and recent errors.
10. Graceful shutdown:
    - Flush in-flight writes and close DB cleanly on app quit/update.
11. Least-privilege git execution:
    - Constrain git operations to trusted project roots.
    - Require explicit user confirmation for destructive operations by default.
12. Protocol versioning:
    - Include protocol version in requests/responses.
    - Keep compatibility shims only at protocol boundary, not in app core logic.

## Contract Extraction (must be first)

Create a shared protocol package (or shared source module) used by both `made-refine` and Mac app:

1. Annotation schemas (`edit`, `comment`, `status`, `session`).
2. HTTP endpoints/events contract.
3. MCP tool names and argument/result schema.
4. Versioned protocol number for backward compatibility.
5. Bootstrap/refresh endpoint payloads and error model.
6. Idempotency key format and retry semantics.

This prevents drift between overlay payloads and app-side broker parsing.

## Suggested Migration Phases

## Phase 0: Compatibility Hardening in `made-refine` (short-term)

1. Replace hardcoded browser MCP base URL with bootstrap-based client.
2. Add runtime config injection path for broker bootstrap endpoint.
3. Add explicit offline/degraded state in overlay when app is unreachable.
4. Add telemetry hooks for bootstrap/send failures.

Outcome: immediate reduction in integration breakage before full extraction.

## Phase 1: Protocol + SDK split

1. Extract shared types/schemas from `src/mcp/types.ts` + HTTP validator layer.
2. Publish internal package (e.g., `@made-refine/protocol`).
3. Update `made-refine` overlay client and app broker code to consume shared schemas.
4. Freeze legacy package-local MCP runtime (no new behavior added).

Outcome: one source of truth for payload contracts.

## Phase 2: Broker in Mac app

1. Implement annotation store in app (persistent).
2. Implement bootstrap + optional token refresh endpoints.
3. Implement HTTP ingest endpoints for overlay submissions.
4. Implement tool handlers equivalent to:
   - `get_pending_edits`
   - `export_all_annotations`
   - `get_edit_details`
   - `acknowledge_edit`
   - `resolve_edit`
   - `dismiss_edit`
   - `watch_edits`
   - `list_all_annotations`
5. Add project/session routing keys:
   - `projectRoot`
   - `workspaceId`
   - `sessionId`
6. Enforce idempotency keys for ingest endpoints.

Outcome: app can fully replace package-local MCP behavior.

## Phase 3: Transport bridge for agents

1. Provide one stable MCP server entrypoint from app:
   - stdio shim binary that forwards to app broker (default path).
   - optional HTTP MCP endpoint for clients that support it.
2. Update Claude/Cursor setup docs to point to single app-managed command.
3. Confirm broker state parity between overlay-ingested data and MCP tool responses.
4. Deprecate direct use of `made-refine-mcp`.

Outcome: one MCP endpoint regardless of project.

## Phase 4: Git workflow integration

1. Add “apply annotation” command pipeline in app.
2. Reuse existing git operation system for:
   - branch selection
   - patch application
   - conflict reporting
   - commit/PR handoff
3. Write back status transitions (`pending -> acknowledged -> applied/dismissed`).

Outcome: end-to-end loop managed by app, not package process.

## Phase 5: Deprecation and cleanup

1. Emit deprecation warnings with migration instructions.
2. Cutover release:
   - remove packaged MCP server runtime from `made-refine`.
   - ship app-owned MCP entrypoint as the only supported runtime.
3. Cleanup:
   - remove compatibility shim + obsolete MCP exports from package.

## Data Model (minimum)

1. `projects`
   - `id`, `rootPath`, `name`, `createdAt`
2. `sessions`
   - `id`, `projectId`, `agent`, `createdAt`, `lastSeenAt`
3. `annotations`
   - `id`, `projectId`, `sessionId`, `type`, `status`, `payload`, `createdAt`, `updatedAt`
4. `events` (optional)
   - append-only state transition log for audit/debug.

## Security + Trust

1. Keep service local-only (`127.0.0.1` / domain socket).
2. Replace single random session token with scoped auth:
   - per-project token
   - short-lived session token
3. Validate origin/project binding to avoid cross-project leakage.
4. Scrub sensitive paths before logging/export unless explicitly requested.

## Reliability Requirements

1. Broker auto-restarts with app and recovers persisted queue.
2. `watch_edits` supports reconnect semantics.
3. Backpressure handling for burst edits.
4. Deterministic status transitions with idempotent update APIs.

## Test Strategy

1. Contract tests (shared schemas + MCP tool payloads).
2. Integration tests:
   - overlay -> broker ingest
   - broker -> MCP tool responses
   - status transitions + persistence
3. Multi-workspace concurrency tests (parallel projects).
4. Failure tests:
   - app restart recovery
   - stale tokens
   - malformed payloads
   - disconnected agent clients

## Execution Gates (No Timeline Labels)

1. Gate 1: bootstrap + ingest communication from package to app broker is stable.
2. Gate 2: MCP tool parity and cross-path state consistency are validated.
3. Gate 3: app-owned MCP entrypoint is default and legacy package runtime is removed.

## Cutover Criteria (Must All Pass)

1. App broker tool parity with existing MCP tools is complete.
2. Overlay ingest and routing is stable across multiple concurrent projects/workspaces.
3. Recovery after app restart preserves pending annotations/status correctly.
4. Agent setup docs validated end-to-end on clean machines.
5. Git apply pipeline in app can process representative real-world edits and report conflicts deterministically.
6. Bootstrap/refresh flows are stable and token rotation does not drop annotations.
7. Overlay-to-broker and MCP-to-broker views return consistent annotation counts/status.

## Post-Cutover Optional Enhancement

1. Add “trusted automation” mode later (per-repo opt-in, explicit risk disclosure, auditable logs).

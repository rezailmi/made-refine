# MCP Server

The MCP server is a local service that AI coding agents (Claude Code, Cursor) connect to in order to receive visual edits and comments captured in the browser overlay. The server is owned and managed by the local Mac app (e.g. DirectCopy) — the `made-refine` npm package only contains the browser-side client (`src/mcp-client.ts`).

## How agents connect

Agents connect via **stdio transport** (the default MCP transport for Claude Code and Cursor). The Mac app exposes a single stable MCP entrypoint command — agents configure it once and it routes across all open projects.

For Claude Code, add the MCP server to your configuration:

```json
{
  "mcpServers": {
    "made-refine": {
      "command": "/path/to/mac-app-mcp-entrypoint"
    }
  }
}
```

## MCP tools

All tools are scoped to the current project and session, identified by `projectId` and `sessionId` (assigned at bootstrap). Tools that mutate state are idempotent — safe to retry on failure.

### `get_pending_edits`

Returns all annotations with `pending` or `acknowledged` status for the current project session.

```
Input:  { projectId, sessionId }
Output: annotation[]
```

### `get_edit_details`

Returns the full payload for a specific annotation, including CSS changes, Tailwind class mappings, React component stack, DOM selector, and a human-readable markdown summary.

```
Input:  { id }
Output: {
  id, type, status,
  element: { tagName, id, classList, domSelector, targetHtml, textPreview },
  source: { fileName, lineNumber, columnNumber } | null,
  reactStack: ReactComponentFrame[],
  changes: { cssProperty, cssValue, tailwindClass }[],
  textChange: { originalText, newText } | null,
  moveChange: {
    fromParentName, toParentName,
    mode, // 'free' | 'reorder'
    fromParentDisplay, toParentDisplay,
    fromParentLayout, toParentLayout,
    draggedPosition, fromIndex, toIndex,
    ...selectorAndSourceAnchors
  } | null,
  exportMarkdown: string
}
```

### `export_all_annotations`

Returns all pending edits and comments for the session as a single markdown document, suitable for pasting into a task description or commit message.

```
Input:  { projectId, sessionId }
Output: { markdown: string }
```

### `acknowledge_edit`

Marks an annotation as seen. Use this to signal that the agent has read the edit and is working on it.

```
Input:  { id }
Status: pending → acknowledged
```

### `resolve_edit`

Marks an annotation as applied. Call this after the code change has been made.

```
Input:  { id }
Status: acknowledged → resolved
```

### `dismiss_edit`

Marks an annotation as skipped without applying it.

```
Input:  { id }
Status: any → dismissed
```

### `watch_edits`

Streams or polls for incoming annotations in real time. Useful for long-running agent sessions that want to react to new edits as the user makes them in the browser.

```
Input:  { projectId, sessionId, since?: timestamp }
Output: SSE stream or polling response of new annotations
```

### `list_all_annotations`

Returns all annotations including comments, across all statuses. Useful for a full session review.

```
Input:  { projectId, sessionId }
Output: annotation[]
```

## Annotation status lifecycle

```
[browser sends] → pending
                     ↓
               acknowledged   (agent has read it)
                     ↓
              resolved | dismissed
```

Annotations move through status transitions via tool calls. The overlay shows a non-blocking indicator while waiting for acknowledgement.

## Project and session routing

Every annotation is scoped to a `projectId + sessionId` pair:

- **`projectId`** — derived from the project's canonical absolute path and git remote fingerprint. This identifies the project uniquely across workspaces.
- **`sessionId`** — identifies a single browser session. Annotations from different sessions within the same project are kept separate.

The server never mixes annotation queues across projects. Multiple concurrent projects are fully isolated.

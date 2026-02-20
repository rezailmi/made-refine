# Runner Workflow

This document traces the complete lifecycle of a visual edit — from selecting an element in the browser, through sending it to the AI agent, to code being applied.

## End-to-end flow

```
Browser (made-refine overlay)               Mac app broker              AI agent (Claude Code / Cursor)
─────────────────────────────               ──────────────              ──────────────────────────────
1. User selects element
2. User edits CSS in panel
3. User clicks "Send to agent"
4. useAgentComms.sendEditToAgent()
5. mcp-client: bootstrap session ─────────► POST /v1/bootstrap
                                 ◄─────────  { ingestBaseUrl, sessionId, accessToken, ... }
6. mcp-client: post annotation ───────────► POST /v1/annotations/edit
                                ◄─────────  { ok: true, id }
                                                    │
                                                    ▼
                                            annotation store
                                            status: pending
                                                    │
                                                    ▼
                                                             ◄── get_pending_edits
                                                             ──► [annotation list]
                                                             ◄── get_edit_details(id)
                                                             ──► { changes, reactStack, source, ... }
7. Agent applies code changes
                                             ◄── resolve_edit(id)
                                             ──► { ok: true }
                                            status: resolved
```

## Step-by-step

### 1. Element selection

When the user clicks an element in edit mode, `useSessionManager.selectElement()` runs:

- Saves any pending styles for the previously selected element to the session map (`Map<HTMLElement, SessionEdit>`)
- Sets the new element as `selectedElement` in state
- Captures the element's current computed styles as `originalStyles`
- Calls `getElementLocator()` to capture the element's identity (see [Preload](preload.md) for how the React component stack is obtained)

### 2. CSS editing

Each property change (spacing, color, typography, etc.) calls the appropriate updater from `useStyleUpdaters`. Updates are applied live to the element's inline styles and accumulated in `pendingStyles`. The panel reflects the live DOM state.

Text edits and element moves are tracked separately in `sessionEdit.textEdit` and `sessionEdit.move`.

### 3. Sending to agent

The user triggers a send in one of two ways:
- **Single edit**: "Send to agent" button in the panel footer (sends the currently selected element's edit)
- **Batch send**: "Send all" in the toolbar EditsPopover (sends every pending edit and comment in the session)

Both call through `useAgentComms` (`src/use-agent-comms.ts`).

### 4. Payload assembly

`sendSessionEditToAgent()` builds the annotation payload:

```typescript
{
  element: {
    tagName: 'div',
    id: 'hero',
    classList: ['flex', 'gap-4'],
    domSelector: 'main > section:nth-child(2) > div',
    targetHtml: '<div class="flex gap-4">...</div>',
    textPreview: 'Get started',
  },
  source: { fileName: 'src/Hero.tsx', lineNumber: 12, columnNumber: 3 } | null,
  reactStack: [
    { name: 'Hero', fileName: 'src/Hero.tsx', lineNumber: 5 },
    { name: 'App', fileName: 'src/App.tsx', lineNumber: 8 },
  ],
  changes: [
    { cssProperty: 'padding-top', cssValue: '24px', tailwindClass: 'pt-6' },
    { cssProperty: 'background-color', cssValue: '#3b82f6', tailwindClass: 'bg-blue-500' },
  ],
  textChange: { originalText: 'Get started', newText: 'Start now' } | null,
  moveChange: MoveInfo | null,
  exportMarkdown: '## Hero\n\n**Changes:**\n- `padding-top: 24px` → `pt-6`\n...',
}
```

Key fields for the agent:
- **`source`** — exact file and line from the Babel plugin (when available). Most reliable for locating the element in source.
- **`reactStack`** — React component hierarchy from the fiber hook. Useful as a fallback when `source` is absent.
- **`changes[].tailwindClass`** — the Tailwind utility that maps to the raw CSS value. The agent applies this class rather than inline styles.
- **`exportMarkdown`** — a pre-formatted human-readable summary the agent can include in commit messages or PR descriptions.

### 5. Session bootstrap and annotation delivery

`mcp-client.ts` handles the HTTP transport:

1. Resolves the Mac app's bootstrap URL (from runtime config or env var)
2. If no cached session, calls `POST /v1/bootstrap` → receives `ingestBaseUrl` + `accessToken`
3. POSTs the annotation to `POST /v1/annotations/edit` with `Authorization: Bearer <token>` and a unique `X-Idempotency-Key`
4. On `401`/`403`, attempts token refresh, then falls back to re-bootstrap, and retries the POST once

### 6. Agent picks up the edit

The agent calls `get_pending_edits` via MCP to check for new annotations, then `get_edit_details` to read the full payload. It uses the `source` file path and `reactStack` to find the right component, then applies the `tailwindClass` values to the JSX.

### 7. Resolution

After applying code changes, the agent calls `resolve_edit` to move the annotation to `resolved` status. The overlay can use this to update its UI state or dismiss the item from the send queue.

## Comment flow

Comments follow the same path via `POST /v1/annotations/comment`. The payload includes:

- Same element identity fields (`tagName`, `domSelector`, `reactStack`, `source`)
- `commentText` — the comment body
- `replies` — array of `{ text, createdAt }` objects
- `exportMarkdown` — formatted for the agent

The agent can access comments via `list_all_annotations`.

## Batch send

`sendAllSessionItemsToAgent()` iterates over `getSessionItems()` — a discriminated union of all pending edits and comments — and sends each one sequentially. It returns `true` only if all sends succeeded.

## Offline behavior

If the Mac app is unreachable at any step, `sendEditToAgent()` returns `false`. The overlay shows a non-blocking indicator. Edits remain in the session and can be retried or exported as markdown for manual application.

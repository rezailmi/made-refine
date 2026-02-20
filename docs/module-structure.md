# Module Structure

The editor UI is split into three layers: **provider** (state + logic), **panel** (inspector UI), and **toolbar** (floating action bar). Each layer delegates to focused hooks and subcomponents.

## Provider (`src/provider.tsx`)

Owns the `DirectEditState` and exposes actions via context. The bulk of the logic lives in extracted hooks that receive refs (`stateRef`, `sessionEditsRef`, etc.) to avoid stale closures:

| Hook | Responsibility |
|---|---|
| `useStyleUpdaters` | Per-property CSS mutation callbacks (`updateSpacingProperty`, `updateColorProperty`, etc.) |
| `useSessionManager` | Session edit lifecycle: select, undo, export, clear, revert |
| `useTextAndComments` | Contenteditable text editing and comment CRUD |
| `useAgentComms` | MCP agent communication (send edits/comments to agent) |
| `useKeyboardShortcuts` | Global `keydown` listeners (Cmd+Z, Escape, Shift+C, etc.) |

All hooks follow the same pattern: accept an `Options` object of refs and stable dispatch functions, return a set of `useCallback`-wrapped functions.

## Panel (`src/panel.tsx`)

The draggable inspector panel. Uses `usePanelPosition` for drag/snap/persist and delegates sections to subcomponents:

| Component | Location |
|---|---|
| `PanelHeader` | `src/panel/panel-header.tsx` — tag name, parent/child nav, close button |
| `PanelFooter` | `src/panel/panel-footer.tsx` — copy edits, send to agent |
| `LayoutSection` | `src/panel/layout-section.tsx` — flex, gap, alignment, sizing, spacing |
| `InteractionOverlay` | `src/panel/interaction-overlay.tsx` — full-screen click capture and hover highlight |

Other panel sections (`border-section`, `fill-section`, `shadow-section`, `typography-inputs`, etc.) were already separate before this refactoring.

## Toolbar (`src/toolbar.tsx`)

The floating toolbar with tool buttons. Complex popovers are extracted:

| Component | Location |
|---|---|
| `EditsPopover` | `src/toolbar/edits-popover.tsx` — copy/send edits popover with per-item actions |
| `SettingsPopover` | `src/toolbar/settings-popover.tsx` — theme and keyboard shortcuts |

Both popovers own their open/close state and use `composedPath()`-based outside-click dismiss (required because base-ui's built-in dismiss does not work inside Shadow DOM).

## Key patterns

- **Ref-based dependency injection**: Hooks receive `stateRef` (a `MutableRefObject<DirectEditState>`) rather than raw state, keeping dependency arrays minimal and avoiding stale closures.
- **Shadow DOM portaling**: All `@base-ui/react` popover/tooltip components portal into the shadow root via `usePortalContainer()`, never `document.body`.
- **Constants**: `PANEL_WIDTH` and `PANEL_HEIGHT` are exported from `src/use-panel-position.ts` as the single source of truth.

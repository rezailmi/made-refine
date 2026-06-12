# Plan 001: Stop hijacking the host app's Cmd+Z when edit mode is off

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d582bd9..HEAD -- src/use-keyboard-shortcuts.ts src/provider.test.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `d582bd9`, 2026-06-12

## Why this matters

made-refine is an overlay that consumers mount inside their own React app during development. The global `keydown` handler in `src/use-keyboard-shortcuts.ts` intercepts Cmd+Z (Ctrl+Z on Windows/Linux) and calls `preventDefault()` + the overlay's `undo()` **unconditionally** — it never checks whether edit mode is active or whether the user is typing in one of the host app's own inputs. Result: while the developer is simply using their app (editor closed), pressing Cmd+Z in any text field, rich-text editor, or canvas of *their own app* is silently swallowed by made-refine. For a tool whose whole value is being a polite guest in someone else's app, this is a high-impact papercut.

## Current state

- `src/use-keyboard-shortcuts.ts` — global keyboard shortcut hook mounted by the provider. Two `useEffect`s: one for the Cmd+Period toggle (lines ~50–59, capture phase, intentionally always active — do not change), and one main `handleKeyDown` listener (attached at line ~182).
- The undo branch (lines 69–74 at planning time):

```ts
      if (undoShortcutPressed && e.key === 'z' && !e.shiftKey) {
        if (s.textEditingElement) return // let browser handle contenteditable undo
        e.preventDefault()
        undo()
        return
      }
```

Note the contrast with the very next branch (group selection), which is properly guarded:

```ts
      if (undoShortcutPressed && (e.code === 'KeyG' || e.key.toLowerCase() === 'g') && !e.shiftKey) {
        if (s.editModeActive && s.selectedElements.length > 1 && !isInputFocused()) {
```

Every other branch in `handleKeyDown` (Shift+Z, Shift+A, f/t/d insert, Delete/Backspace, Enter, canvas zoom) checks `s.editModeActive` (or `s.canvas?.active`) and most also check `isInputFocused()`. The undo branch is the only one missing both guards.

- `isInputFocused` is already imported at the top of the file: `import { isTextElement, isInputFocused } from './utils'` (defined at `src/utils.ts:62`).
- Existing keyboard tests live in `src/provider.test.tsx` — see the Cmd+Z dispatches at lines ~892–897:

```ts
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
        ...
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))
```

Those existing tests exercise undo **with edit mode active** — they must keep passing.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install`                            | exit 0              |
| Typecheck | `bunx tsc --noEmit`                      | exit 0, no errors   |
| Targeted tests | `bunx vitest run src/provider.test.tsx` | all pass       |
| Full gate | `bun run test` (runs a full build first) | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/use-keyboard-shortcuts.ts`
- `src/provider.test.tsx` (add tests)

**Out of scope** (do NOT touch):
- The Cmd+Period toggle effect in the same file — it must keep working when edit mode is off; that is its purpose.
- The Escape branch — its guards (`textEditingElement` / `activeCommentId` / `isOpen` / `selectedElements` / `editModeActive`) already make it a no-op when the editor is idle, and it never calls `preventDefault()` for the host app's Escape.
- `src/use-session-manager.ts` (`undo()` implementation) — no changes needed there.

## Git workflow

- Branch: `advisor/001-guard-global-undo-shortcut`
- Commit message style matches repo history (e.g. `fix: prevent pointer events from reaching page elements during drag`): use `fix: don't intercept Cmd+Z when edit mode is inactive`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the guards to the undo branch

In `src/use-keyboard-shortcuts.ts`, change the undo branch to:

```ts
      if (undoShortcutPressed && e.key === 'z' && !e.shiftKey) {
        if (!s.editModeActive) return // never steal the host app's undo
        if (s.textEditingElement) return // let browser handle contenteditable undo
        if (isInputFocused()) return // let panel/host inputs keep native undo
        e.preventDefault()
        undo()
        return
      }
```

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Run existing tests to confirm no regression

**Verify**: `bunx vitest run src/provider.test.tsx` → all pass. Both guards are confirmed product decisions (maintainer review 2026-06-12): Cmd+Z must do native field undo while a panel input is focused, matching Figma. If an existing test performs undo while an input is focused and now fails, UPDATE that test's expectation (it encodes the old behavior) and note this in your report — do not remove either guard.

### Step 3: Add regression tests

In `src/provider.test.tsx`, next to the existing undo keyboard tests (~line 892), add two tests modeled on the surrounding test structure:

1. **Edit mode off → Cmd+Z not intercepted**: render the provider without activating edit mode, dispatch `new KeyboardEvent('keydown', { key: 'z', metaKey: true, cancelable: true })` on `window`, and assert `event.defaultPrevented === false` (dispatch returns the event's not-cancelled status; capture the event object in a variable to check `defaultPrevented`).
2. **Edit mode on → Cmd+Z still performs undo**: mirror the existing passing test to lock in current behavior (skip if an equivalent assertion already exists at ~892–897).

**Verify**: `bunx vitest run src/provider.test.tsx` → all pass, including the new tests.

## Test plan

- New: "does not preventDefault Cmd+Z when edit mode is inactive" (the regression this plan fixes).
- New/existing: "performs undo on Cmd+Z when edit mode is active".
- Pattern: model after the existing keyboard tests in `src/provider.test.tsx:850–900`.
- Verification: `bun run test` → all pass.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0; a test asserting Cmd+Z is NOT intercepted when edit mode is off exists and passes
- [ ] The undo branch in `src/use-keyboard-shortcuts.ts` contains an `editModeActive` guard before `preventDefault()`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The undo branch at `src/use-keyboard-shortcuts.ts:69–74` no longer matches the excerpt above (drift).
- More than one existing test fails after Step 1 — that suggests the suite intentionally relies on undo working outside edit mode, which changes the design question.
- You find that `undo()` is expected to revert edits *after* the user closes edit mode as a product feature (e.g. a test or doc explicitly asserts it) — that is a maintainer decision, not yours.

## Maintenance notes

- Any future shortcut added to `handleKeyDown` should follow the same guard pattern: check `s.editModeActive` (or a narrower state) and `isInputFocused()` before calling `preventDefault()`. Reviewers should reject new branches that don't.
- Deferred (recorded in `plans/README.md` backlog): a dedicated `src/use-keyboard-shortcuts.test.ts` covering all branches.

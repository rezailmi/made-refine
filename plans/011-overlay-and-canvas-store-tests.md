# Plan 011: Add unit tests for the untested overlays and canvas-store

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1687d9..HEAD -- src/panel/interaction-overlay.tsx src/multi-selection-overlay.tsx src/canvas-store.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (test-only; the one source edit is adding `export` keywords)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `c1687d9`, 2026-06-13

## Why this matters

`TODOS.md` documents three files with zero test coverage whose pure helpers are
crash-prone: `getGroupBounds` (empty-array bounding box),
`dedupeConnectedElements` (filters disconnected nodes), and the synchronous
`canvas-store` external store that overlays depend on to track the DOM
transform. These are exactly the helpers that a future refactor can silently
break. This plan adds focused unit tests for the **pure, easily-testable**
surface of each, following the repo's existing pure-function test pattern. It
deliberately does *not* attempt full jsdom simulation of the capture-phase
pointer pipeline in `interaction-overlay.tsx` (that is harder and lower-value);
it covers the helpers most likely to crash.

## Current state

- `src/multi-selection-overlay.tsx` (131 lines) — two **module-private** pure
  helpers (currently not exported):
  ```ts
  // src/multi-selection-overlay.tsx:15
  function dedupeConnectedElements(elements: HTMLElement[]): HTMLElement[] {
    const seen = new Set<HTMLElement>()
    const result: HTMLElement[] = []
    for (const element of elements) {
      if (!element.isConnected || seen.has(element)) continue
      seen.add(element)
      result.push(element)
    }
    return result
  }
  // src/multi-selection-overlay.tsx:28
  function getGroupBounds(rects: DOMRect[]) {
    if (rects.length === 0) {
      return { left: 0, top: 0, right: 0, bottom: 0 }
    }
    return rects.reduce((bounds, rect) => ({
      left: Math.min(bounds.left, rect.left),
      top: Math.min(bounds.top, rect.top),
      right: Math.max(bounds.right, rect.right),
      bottom: Math.max(bounds.bottom, rect.bottom),
    }), { left: rects[0].left, top: rects[0].top, right: rects[0].right, bottom: rects[0].bottom })
  }
  ```
  To unit-test them they must be exported (additive — does not change the
  component's behavior or its default export).
- `src/canvas-store.ts` (44 lines) — a module-global external store. Already
  exports: `getBodyOffset`, `setBodyOffset`, `getCanvasSnapshot`,
  `setCanvasSnapshot`, `registerCanvasStoreOwner`, `useCanvasSnapshot`,
  plus `DEFAULT` shape `{ active, zoom, panX, panY }`. State is **module-level
  global** — tests must reset it between cases (set back to default) because the
  module is shared across the test file.
- `src/panel/interaction-overlay.tsx` (467 lines) — `useInteractionCapture`
  installs capture-phase listeners; `isStale()` (line ~145) checks the host
  `[data-direct-edit-host]` is connected; `handleWindowPointerUp` and marquee
  logic live in closure locals. Pure helpers worth testing without the full
  hook: `normalizeMarqueeRect` (line ~24), `rectsIntersect` (line ~35),
  `compareDomOrder` (line ~61), `isSelectableElement` (line ~44). These are
  also module-private and would need exporting to unit-test directly.
- **Test conventions** (follow these exactly):
  - Pure-function test exemplar: `src/utils/resize-geometry.test.ts` —
    `import { afterEach, describe, expect, it } from 'vitest'`, an
    `afterEach(() => { document.body.innerHTML = '' })`, then `describe`/`it`
    blocks asserting return values. Co-located next to the source.
  - DOM-event / host-element exemplar: `src/provider.test.tsx` uses
    `@testing-library/react` (`render`, `fireEvent`, `act`), queries
    `[data-direct-edit-host]`, and dispatches real events
    (`window.dispatchEvent(new KeyboardEvent(...))`, `el.dispatchEvent(new
    MouseEvent('click', ...))`).
  - Test runner: `vitest` with `jsdom` (see `vitest.config.ts`). `DOMRect` is
    available in jsdom; construct with `new DOMRect(x, y, w, h)` or an object
    literal cast — verify which jsdom accepts (prefer `new DOMRect(...)`; if it
    throws in jsdom, build a plain object with `left/top/right/bottom` getters).

## Commands you will need

| Purpose   | Command                                                  | Expected on success |
|-----------|----------------------------------------------------------|---------------------|
| Install   | `bun install`                                            | exit 0              |
| Typecheck | `bunx tsc --noEmit`                                      | exit 0, no errors   |
| New tests | `bunx vitest run src/multi-selection-overlay.test.ts src/canvas-store.test.ts src/panel/interaction-overlay.test.ts` | all pass |
| Full gate | `bun run test`                                          | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `src/multi-selection-overlay.tsx` (add `export` to the two helpers — additive)
- `src/panel/interaction-overlay.tsx` (add `export` to the four pure helpers — additive)
- `src/multi-selection-overlay.test.ts` (create)
- `src/canvas-store.test.ts` (create)
- `src/panel/interaction-overlay.test.ts` (create)

**Out of scope** (do NOT touch):
- Any behavior inside the overlays or the store — exporting a helper is the
  only source change permitted.
- Full simulation of the `useInteractionCapture` drag/marquee/click pipeline —
  explicitly deferred (it needs the full capture-phase event sequence; not
  worth the brittleness here). Test the extractable pure helpers only.
- `selection-overlay.tsx`, `measurement-overlay.tsx`, other overlays.

## Git workflow

- Branch: `advisor/011-overlay-canvas-tests`
- Commit message: `test: cover multi-selection/interaction overlay helpers and canvas-store`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Export the pure helpers (additive)

- In `src/multi-selection-overlay.tsx`: add `export` to `dedupeConnectedElements`
  (line ~15) and `getGroupBounds` (line ~28). Change nothing else.
- In `src/panel/interaction-overlay.tsx`: add `export` to `normalizeMarqueeRect`
  (line ~24), `rectsIntersect` (line ~35), `compareDomOrder` (line ~61), and
  `isSelectableElement` (line ~44). Change nothing else.

**Verify**: `bunx tsc --noEmit` → exit 0 (adding `export` is non-breaking).

### Step 2: Test `multi-selection-overlay` helpers

Create `src/multi-selection-overlay.test.ts`, modeled on
`src/utils/resize-geometry.test.ts`. Cover:
- `getGroupBounds([])` → `{ left: 0, top: 0, right: 0, bottom: 0 }` (the empty
  crash vector named in `TODOS.md`).
- `getGroupBounds` with a single rect → that rect's bounds.
- `getGroupBounds` with three overlapping rects → the min/max envelope.
- `dedupeConnectedElements`: pass a connected element twice → returns it once.
- `dedupeConnectedElements`: pass a detached element (created via
  `document.createElement` but never appended) → it is filtered out
  (`isConnected === false`). Append one element to `document.body` and leave
  another detached; assert only the connected one survives.

**Verify**: `bunx vitest run src/multi-selection-overlay.test.ts` → all pass.

### Step 3: Test `canvas-store`

Create `src/canvas-store.test.ts`. Because the store is a module global, add
`afterEach(() => { setCanvasSnapshot({ active: false, zoom: 1, panX: 0, panY: 0 }); setBodyOffset({ x: 0, y: 0 }) })`
to isolate cases. Cover:
- `getCanvasSnapshot()` returns the default before any set.
- `setCanvasSnapshot(next)` then `getCanvasSnapshot()` returns `next`.
- A subscriber registered via `useCanvasSnapshot` is notified — OR, to avoid
  rendering, test the notification path through the exported setters by
  asserting `getCanvasSnapshot()` reflects the update (the subscribe mechanism
  is internal; if you can reach `subscribe`, assert the callback fires on set;
  if not, assert snapshot identity changes).
- `getBodyOffset()` / `setBodyOffset({ x, y })` round-trips.
- `registerCanvasStoreOwner()` returns a disposer; calling it twice without the
  disposer increments owner count (the second call warns only when
  `NODE_ENV !== 'test'`, so in the test env it must **not** throw and the
  disposer must decrement without going negative — call the disposer twice and
  assert no throw).

**Verify**: `bunx vitest run src/canvas-store.test.ts` → all pass.

### Step 4: Test `interaction-overlay` pure helpers

Create `src/panel/interaction-overlay.test.ts`. Cover:
- `normalizeMarqueeRect`: given origin (10,10) and a pointer at (40,30),
  returns a rect with `left=10, top=10, width=30, height=20`; given a pointer
  **above-left** of origin (origin (40,30), pointer (10,10)), it normalizes so
  `left=10, top=10` (no negative width). Read the function body first to
  confirm the exact return shape (`MarqueeRect`) and assert against it.
- `rectsIntersect`: two overlapping rects → `true`; two disjoint rects →
  `false`; edge-touching rects → match the function's actual boundary semantics
  (read the comparison operators to decide `>=` vs `>`).
- `compareDomOrder`: append two elements to `document.body` in order A then B;
  `compareDomOrder(A, B)` is negative, `compareDomOrder(B, A)` is positive,
  `compareDomOrder(A, A)` is 0 — matching `Array.prototype.sort` contract.
- `isSelectableElement`: an element matching
  `[data-direct-edit-host]` → `false`; a `<script>` → `false`; a plain `<div>`
  appended to the body → `true`. (Read line ~48 for the exact exclusion
  selector and mirror it.)

**Verify**: `bunx vitest run src/panel/interaction-overlay.test.ts` → all pass.

### Step 5: Full gate

**Verify**: `bun run test` → all pass; total count is baseline + the new tests
(≥ ~15 new cases across the three files).

## Test plan

Summarized above per step. Patterns: pure-function assertions modeled on
`src/utils/resize-geometry.test.ts`; DOM element construction via
`document.createElement` / `document.body.appendChild` with an
`afterEach` cleanup (`document.body.innerHTML = ''`). No mocking of timers or
network needed. If `new DOMRect(...)` is unavailable in jsdom, fall back to a
typed object literal exposing `left/top/right/bottom/width/height`.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] The three new test files exist and `bunx vitest run` passes them
- [ ] `bun run test` exits 0; total test count increased by ≥ 15
- [ ] Source changes are limited to added `export` keywords (`git diff
      src/multi-selection-overlay.tsx src/panel/interaction-overlay.tsx` shows
      only `export` additions, no logic changes)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A pure helper's real signature/return shape differs from the "Current state"
  excerpt (drift) — re-read and report rather than guessing assertions.
- `new DOMRect` and the object-literal fallback both fail to satisfy the
  helper's type in jsdom — report the typing obstacle.
- Testing `canvas-store`'s subscriber notification requires rendering a
  component and that proves flaky after two attempts — ship the setter/getter
  tests and report the subscription test as deferred.
- Exporting any helper causes a typecheck or lint failure elsewhere (it should
  not — these are leaf functions).

## Maintenance notes

- The full `useInteractionCapture` pointer pipeline (drag session, marquee
  start, `suppressClickRef`, `isStale()` mid-sequence) remains untested and is
  the higher-value-but-harder follow-up. The `TODOS.md` entry describes the
  approach: dispatch a full `pointerdown → pointermove → pointerup → click`
  sequence against the capture-phase listeners and remove the
  `[data-direct-edit-host]` element mid-sequence to exercise `isStale()`. Model
  it on `src/provider.test.tsx`'s event-dispatch helpers. Leave the `TODOS.md`
  entries in place but note in the PR which crash vectors are now covered.
- A reviewer should scrutinize: that the added `export`s did not accidentally
  change a default-export or alter tree-shaking assumptions in `src/index.ts`
  (they should not — these helpers are not part of the public surface).

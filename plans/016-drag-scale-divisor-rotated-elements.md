# Plan 016: Correct the drag scale-divisor math for rotated elements

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1687d9..HEAD -- src/use-move.ts src/use-selection-resize.ts`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.
>
> **Conditional plan**: This is a known, pre-existing, low-severity edge case
> (plan 002 documented it without fixing it; live validation found rotated drag
> "tracked acceptably"). Step 0 gates the work: confirm the artifact is real and
> worth fixing before changing math that currently works for the common case. If
> it is not observable, mark REJECTED.

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: MED (touches pointer-tracking math used by every drag/resize, not
  just rotated ones — a wrong "fix" degrades the common, working case)
- **Depends on**: none
- **Category**: bug (edge case)
- **Planned at**: commit `c1687d9`, 2026-06-13

## Why this matters

When converting a pointer delta in screen pixels to an element-local delta,
the code divides by a "scale" derived from `getBoundingClientRect().width /
element.offsetWidth`. For an axis-aligned scaled element that ratio *is* the
scale. But `getBoundingClientRect()` returns the **axis-aligned bounding box**,
which for a **rotated** element is larger than the element's own width — so the
ratio overstates the scale and pointer tracking lags slightly during drag/resize
of rotated elements. This is pre-existing and minor; the value of this plan is
correctness for the rotated case **without regressing** the dominant unrotated
case. Because the risk is asymmetric (the current code is correct for the 99%
case), this plan is gated on confirming the artifact is worth fixing.

## Current state

The same bounding-box-as-scale pattern appears in two places:

- `src/use-move.ts:357-362` — drag start captures the scale:
  ```ts
  initialRectRef.current = {
    x: rect.left,
    y: rect.top,
    scaleX: element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1,
    scaleY: element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1,
  }
  ```
  where `rect = element.getBoundingClientRect()` (line 352).
- `src/use-selection-resize.ts:100-106` — resize start does the same:
  ```ts
  const offsetWidth = selectedElement.offsetWidth
  const offsetHeight = selectedElement.offsetHeight
  const startWidth = clampSize(offsetWidth > 0 ? offsetWidth : rect.width, MIN_SIZE_PX)
  const startHeight = clampSize(offsetHeight > 0 ? offsetHeight : rect.height, MIN_SIZE_PX)
  const scaleX = Math.max(EPSILON, offsetWidth > 0 ? rect.width / offsetWidth : 1)
  const scaleY = Math.max(EPSILON, offsetHeight > 0 ? rect.height / offsetHeight : 1)
  ```
- `src/use-session-manager.ts:545-548` uses the same pattern on `document.body`
  (canvas zoom) — **the body is never rotated**, so that site is correct and is
  **out of scope**.
- Plan `002` (`plans/002-compose-transforms-during-drag.md`) documents this
  artifact in its maintenance notes and explicitly chose not to fix it.

The correct scale for a possibly-rotated element comes from the element's
**transform matrix**, not its bounding box. `getComputedStyle(el).transform`
returns a `matrix(a, b, c, d, e, f)` (or `matrix3d`), from which the X/Y scale
factors are `hypot(a, b)` and `hypot(c, d)` respectively — these are rotation-
invariant. `DOMMatrix` can parse the string: `new DOMMatrix(transformString)`.

## Commands you will need

| Purpose   | Command                                                  | Expected on success |
|-----------|----------------------------------------------------------|---------------------|
| Install   | `bun install`                                            | exit 0              |
| Typecheck | `bunx tsc --noEmit`                                      | exit 0, no errors   |
| Tests     | `bunx vitest run src/use-move src/use-selection-resize` | all pass            |
| Full gate | `bun run test`                                           | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `src/use-move.ts` (scale capture at drag start)
- `src/use-selection-resize.ts` (scale capture at resize start)
- A small shared helper for matrix-derived scale, placed in
  `src/utils/resize-geometry.ts` (it already holds geometry helpers and has a
  test file) — export `getElementScale(el): { scaleX, scaleY }`
- `src/utils/resize-geometry.test.ts` (add tests for the helper)

**Out of scope** (do NOT touch):
- `src/use-session-manager.ts` body/canvas-zoom scale — the body is not rotated;
  changing it risks the canvas-mode math for no benefit.
- The drag/resize *behavior* beyond the scale divisor — only the scale source
  changes; the delta application stays the same.
- `getBoundingClientRect` usage for **position** (`rect.left/top`) — only the
  width/height-as-scale ratio is wrong; positions are fine.

## Git workflow

- Branch: `advisor/016-rotated-drag-scale`
- Commit message: `fix: derive drag/resize scale from transform matrix, not bbox, for rotated elements`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0 (GATE): Confirm the artifact is worth fixing

Reproduce in the dev app (`bun run dev:app`, open the served URL): apply
`transform: rotate(45deg)` to an element, enter edit mode, and drag it. Observe
whether the element visibly lags the pointer. Decision rule:
- If there is **no observable lag** for a typical rotation (≤45°) and typical
  element sizes, **STOP** and mark this finding REJECTED in `plans/README.md`
  ("bbox-vs-matrix scale error negligible for realistic rotations").
- If lag is observable, proceed.

**Verify**: record the observation (rotation angle, whether lag was visible).

### Step 1: Add a matrix-derived scale helper

In `src/utils/resize-geometry.ts`, add:
```ts
/** Rotation-invariant scale factors from an element's transform matrix.
 *  Falls back to {1,1} when no transform is present. */
export function getElementScale(element: HTMLElement): { scaleX: number; scaleY: number } {
  const t = getComputedStyle(element).transform
  if (!t || t === 'none') return { scaleX: 1, scaleY: 1 }
  const m = new DOMMatrix(t)
  return {
    scaleX: Math.hypot(m.a, m.b) || 1,
    scaleY: Math.hypot(m.c, m.d) || 1,
  }
}
```
This composes correctly with rotation because `hypot(a,b)` extracts the scale
magnitude regardless of the rotation angle baked into `a,b,c,d`.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Test the helper

In `src/utils/resize-geometry.test.ts`, add cases (jsdom supports `DOMMatrix`;
if it does not, see STOP conditions):
- No transform → `{ scaleX: 1, scaleY: 1 }`.
- `scale(2, 3)` → `{ scaleX: 2, scaleY: 3 }`.
- `rotate(45deg)` (no scale) → `{ scaleX: 1, scaleY: 1 }` (within a small
  epsilon) — this is the core assertion: rotation alone must NOT inflate scale.
- `rotate(30deg) scale(2)` → `{ scaleX: 2, scaleY: 2 }` (within epsilon).

Set the transform via an inline style on a created element and read it back.

**Verify**: `bunx vitest run src/utils/resize-geometry.test.ts` → all pass.

### Step 3: Use the helper at the two capture sites

- `src/use-move.ts:357-362`: replace the `rect.width / offsetWidth` /
  `rect.height / offsetHeight` ratios with `getElementScale(element)`:
  ```ts
  const { scaleX, scaleY } = getElementScale(element)
  initialRectRef.current = { x: rect.left, y: rect.top, scaleX, scaleY }
  ```
  Keep the `offsetWidth > 0` style guard semantics: `getElementScale` already
  returns `{1,1}` when there is no transform, which matches the old fallback for
  unscaled elements. Add the import from `'./utils/resize-geometry'`.
- `src/use-selection-resize.ts:105-106`: replace the two `scaleX`/`scaleY`
  computations with the helper. **Preserve** the `Math.max(EPSILON, ...)` clamp
  by clamping the helper's result: `const { scaleX: rawSX, scaleY: rawSY } =
  getElementScale(selectedElement); const scaleX = Math.max(EPSILON, rawSX)`.
  Leave `startWidth`/`startHeight` (which use `offsetWidth`) unchanged — those
  are sizes, not scales, and are already correct.

**Verify**: `bunx vitest run src/use-move src/use-selection-resize` → all pass.

### Step 4: Regression-check the common (unrotated) case

The dominant case is an element with **no transform** or an axis-aligned
`scale()`. For those, `getElementScale` returns exactly what the old ratio
returned (`{1,1}` for no transform; `{sx,sy}` for `scale(sx,sy)`), so unrotated
drag/resize must behave identically.

**Verify**:
- `bun run test` → full suite passes (508 baseline, none regressed).
- Manually in the dev app: drag and resize an **unrotated** element — tracking
  is 1:1 with the pointer (unchanged from before).

## Test plan

- New unit tests for `getElementScale` in
  `src/utils/resize-geometry.test.ts`: no-transform, pure scale, pure rotation
  (the regression-defining case: must be ~1), rotation+scale. Pattern: existing
  cases in that file (construct element, set inline transform, assert).
- Existing `use-move` / `use-selection-resize` tests are the regression net for
  the unrotated path; they must pass unchanged.

## Done criteria

- [ ] Step 0 decision recorded (proceeded, or REJECTED with rationale)
- [ ] If proceeding: `getElementScale` exists in `src/utils/resize-geometry.ts`
      with tests covering rotation-invariance
- [ ] Both `use-move.ts` and `use-selection-resize.ts` derive scale from the
      helper; `grep -n "rect.width / .*offsetWidth\|rect.height / .*offsetHeight" src/use-move.ts src/use-selection-resize.ts` returns no matches
- [ ] `src/use-session-manager.ts` is unchanged (`git diff` does not list it)
- [ ] `bunx tsc --noEmit` exits 0; `bun run test` passes
- [ ] `plans/README.md` status row updated (DONE or REJECTED)

## STOP conditions

Stop and report back (do not improvise) if:

- Step 0 shows no observable lag → mark REJECTED, change nothing.
- `DOMMatrix` is unavailable or behaves incorrectly in jsdom for the unit tests
  (jsdom's `DOMMatrix` support has gaps) — report it; options are a manual
  matrix-string parse helper, or testing the helper only in a browser context.
  Do NOT ship the helper untested.
- The unrotated-case regression check shows ANY change in tracking for elements
  without rotation — the helper must be a no-op there; if it isn't, the math is
  wrong, revert.
- Replacing the resize scale drops the `EPSILON` clamp — that clamp prevents
  divide-by-zero downstream and must be preserved.

## Maintenance notes

- This corrects scale magnitude but **not** the axis-shear introduced by
  rotation: a fully correct rotated-drag would transform the pointer delta
  through the inverse rotation matrix, not just divide by per-axis scale. That
  larger fix is deliberately out of scope; if rotated-element editing becomes a
  first-class feature, revisit with full matrix-inverse delta mapping. Note this
  in the PR.
- `skew()` transforms are also not handled by per-axis scale; same deferral.
- A reviewer should focus on the unrotated regression check — the failure mode
  of this change is degrading the common case to fix a rare one.

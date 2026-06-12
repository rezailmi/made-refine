# Plan 002: Preserve an element's existing CSS transform while dragging it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d582bd9..HEAD -- src/use-move.ts src/use-move.test.tsx TODOS.md`
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

When the user drags an element that already has a CSS transform (e.g. `rotate(45deg)` or `scale(1.2)`), the drag implementation overwrites `element.style.transform` with a bare `translate(dx, dy)`. The rotation/scale visually disappears during the drag and snaps back on drop — a jarring glitch in the core visual-editing interaction. The maintainer analyzed the inline-style case in `TODOS.md` ("Compose existing element transforms during drag"); this plan executes that fix **extended to stylesheet/class-based transforms** (maintainer decision, 2026-06-12): in made-refine's Tailwind-centric audience, a transform almost always comes from a class like `rotate-45`, not an inline style, so when there is no inline transform we snapshot `getComputedStyle(el).transform` (a resolved `matrix(...)`) at drag start and compose against that. The drop-position math is already correct (the `rect.width / offsetWidth` scale factors account for the element's own transform) — only the visual during drag is wrong.

## Current state

- `TODOS.md` (repo root, first entry) — the maintainer's analysis. Read it before starting. Key conclusion: prepend the translate, in local/pre-transform space: `translate(dx/scaleX, dy/scaleY) ${originalTransform}`. A naive append (`${original} translate(...)`) is wrong because CSS transforms compose right-to-left.
- `src/use-move.ts` — the free-move drag hook.
  - `originalTransformRef` declared at line ~157: `const originalTransformRef = React.useRef('')`.
  - Captured at drag start (line ~358, inside `startDrag`): `originalTransformRef.current = element.style.transform`.
  - Scale factors captured at line ~352–357:

```ts
      initialRectRef.current = {
        x: rect.left,
        y: rect.top,
        scaleX: element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1,
        scaleY: element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1,
      }
```

  - The buggy line, in `handlePointerMove` (line ~395–399):

```ts
      if (draggedElement) {
        const { x, y, scaleX, scaleY } = initialRectRef.current
        const dx = (e.clientX - dragOffset.x - x) / scaleX
        const dy = (e.clientY - dragOffset.y - y) / scaleY
        draggedElement.style.transform = `translate(${dx}px, ${dy}px)`
      }
```

  - Restore sites that already use `originalTransformRef` (do not break them): line ~264 (`cancelDrag` path) and line ~288 (`completeDrag` path) both do `draggedElement.style.transform = originalTransformRef.current`, then reset the ref to `''`. **This restore contract stays inline-only**: when the element's transform came from a class, restoring the inline value to `''` lets the stylesheet rule re-apply on its own — do not write the computed matrix back as an inline style on drop, or you'd freeze a class-based transform into an inline one.
- `src/use-move.test.tsx` (1,065 lines) — existing drag tests; use as the structural pattern for the new test. It dispatches pointer events and asserts on `element.style.transform`.
- jsdom caveat: `getBoundingClientRect`/`offsetWidth` return zeros in jsdom unless the existing tests mock them, and `getComputedStyle(el).transform` will not resolve class-based transforms in jsdom. Tests therefore verify *composition semantics* (string assembly, restore behavior) using inline styles and, for the computed path, a mocked `getComputedStyle` — real geometry is verified manually in the demo app (`bun run dev:app`). Follow whatever rect-mocking approach the existing tests in this file already use.

## Commands you will need

| Purpose   | Command                                | Expected on success |
|-----------|----------------------------------------|---------------------|
| Install   | `bun install`                          | exit 0              |
| Typecheck | `bunx tsc --noEmit`                    | exit 0, no errors   |
| Targeted tests | `bunx vitest run src/use-move.test.tsx` | all pass       |
| Full gate | `bun run test` (runs a full build first) | all pass          |

## Scope

**In scope** (the only files you should modify):
- `src/use-move.ts` (one line in `handlePointerMove`)
- `src/use-move.test.tsx` (add tests)
- `TODOS.md` (remove the completed entry "Compose existing element transforms during drag" only)

**Out of scope** (do NOT touch):
- The scale-factor math in `startDrag` — TODOS.md confirms it is already correct.
- The restore logic in `cancelDrag`/`completeDrag` — restoring `originalTransformRef.current` remains correct with this change.
- `src/use-canvas.ts`, `src/use-selection-resize.ts` — separate interactions.
- The reorder-preview transform logic (`setReorderPreviewTransform`, `REORDER_PREVIEW_TRANSITION`) in the same file — it manages sibling elements, not the dragged element.

## Git workflow

- Branch: `advisor/002-compose-transforms-during-drag`
- Commit message: `fix: compose existing element transform during drag`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Capture the compose base at drag start

In `src/use-move.ts`, next to `originalTransformRef` (~line 157), add a second ref:

```ts
  // What to append after the drag translate: the inline transform if present,
  // else the computed matrix snapshot (covers class-based transforms like Tailwind's rotate-45).
  const composeBaseRef = React.useRef('')
```

In `startDrag` (~line 358), replace `originalTransformRef.current = element.style.transform` with:

```ts
      const inlineTransform = element.style.transform
      originalTransformRef.current = inlineTransform // restore target stays inline-only
      if (inlineTransform) {
        composeBaseRef.current = inlineTransform
      } else {
        const computed = getComputedStyle(element).transform
        composeBaseRef.current = computed && computed !== 'none' ? computed : ''
      }
```

Also reset `composeBaseRef.current = ''` at the two places that reset `originalTransformRef.current = ''` (`cancelDrag` ~line 267 and `completeDrag` ~line 291).

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Compose the transform in `handlePointerMove`

Change the assignment (~line 395–399) to prepend the translate to the compose base (empty base → bare translate, no trailing space):

```ts
      if (draggedElement) {
        const { x, y, scaleX, scaleY } = initialRectRef.current
        const dx = (e.clientX - dragOffset.x - x) / scaleX
        const dy = (e.clientY - dragOffset.y - y) / scaleY
        const base = composeBaseRef.current
        draggedElement.style.transform = base
          ? `translate(${dx}px, ${dy}px) ${base}`
          : `translate(${dx}px, ${dy}px)`
      }
```

The translate stays divided by `scaleX`/`scaleY` per TODOS.md. Known approximation, accepted for this plan: for a *rotated* element, `rect.width / offsetWidth` is bounding-box inflation rather than pure scale, so pointer tracking can lag slightly during the drag — this is no worse than the current behavior (which captures the same ratio), and the final drop position is computed from `getBoundingClientRect` in `completeDrag`, which is unaffected. Do not redesign the scale math in this plan; if manual verification (Step 4) shows severe mis-tracking, that is a STOP condition, not a license to improvise.

**Verify**: `bunx vitest run src/use-move.test.tsx` → all existing tests pass. (Tests asserting a bare `translate(...)` for untransformed elements still pass via the empty-base branch. If an existing test sets an inline transform before dragging and asserts a bare translate, that test encodes the bug — update its expectation and say so in your report.)

### Step 3: Add the regression tests

In `src/use-move.test.tsx`, following the structure of an existing drag test (pointer down → move → up):

1. **Inline transform**: element with `element.style.transform = 'rotate(45deg)'` → mid-drag `element.style.transform` matches `/^translate\(.+\) rotate\(45deg\)$/` (translate first — order is the point of the fix); after pointer up, transform restored to exactly `rotate(45deg)`.
2. **Class/computed transform**: element with NO inline transform, with `getComputedStyle` mocked (e.g. `vi.spyOn(window, 'getComputedStyle')` returning `{ transform: 'matrix(0.707, 0.707, -0.707, 0.707, 0, 0)' , ...real impl for other props }`) → mid-drag transform matches `/^translate\(.+\) matrix\(/`; after pointer up, inline transform restored to `''` (empty — the stylesheet owns it again).
3. **No transform**: mid-drag transform is a bare `translate(...)` with no trailing space.

**Verify**: `bunx vitest run src/use-move.test.tsx` → all pass including 3 new tests.

### Step 4: Manual geometry check in the demo app

Run `bun run dev:app`, add `style={{ transform: 'rotate(45deg)' }}` (and separately a Tailwind `rotate-45` class) to an element in `src/demo.tsx` temporarily, and drag it: the element must stay rotated while dragging and land where dropped. Revert the demo.tsx experiment before committing (`git checkout -- src/demo.tsx` if needed).

**Verify**: `git status` → `src/demo.tsx` not modified.

### Step 5: Remove the completed TODO entry

Delete the "Compose existing element transforms during drag" section from `TODOS.md` (lines 3–13 at planning time), leaving the other entries intact.

**Verify**: `grep -c "Compose existing element transforms" TODOS.md` → `0` (grep exits 1 with count 0; that is the expected outcome).

## Test plan

- New test: drag an element with inline `transform: rotate(45deg)` → mid-drag transform is `translate(...) rotate(45deg)`, post-drop transform is `rotate(45deg)`.
- New test: drag an element whose transform comes only from computed styles (mocked `getComputedStyle`) → mid-drag transform is `translate(...) matrix(...)`, post-drop inline transform is `''`.
- New test: drag an element with no transform → mid-drag transform is bare `translate(...)`.
- Pattern: model after existing pointer-event drag tests in `src/use-move.test.tsx`; follow their existing rect/style mocking approach.
- Verification: `bun run test` → all pass.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0; all three new tests exist and pass
- [ ] `grep -n 'style.transform = \`translate' src/use-move.ts` shows the composed form (or the conditional), not a bare overwrite
- [ ] TODOS.md no longer lists the transform-composition item
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `handlePointerMove` in `src/use-move.ts` no longer contains the bare `translate(${dx}px, ${dy}px)` assignment (someone may have already fixed it).
- More than two existing tests in `src/use-move.test.tsx` fail after Step 1 — the composition may interact with the reorder-preview snapshots in a way this plan didn't anticipate.
- The mid-drag assertion is impossible because the test harness can't observe styles between pointer events — report what the harness supports instead of restructuring the hook.
- The Step 4 manual check shows severe pointer mis-tracking for rotated elements (element drifting far from the cursor) — the scale-divisor math needs a redesign (parent-based ancestor scale instead of the element's own bounding-box ratio), which is out of this plan's scope. Report it.

## Maintenance notes

- If a future feature writes `element.style.transform` during drag from another code path (e.g. snapping), it must use the same composition rule (translate first, compose base after).
- The computed-matrix snapshot freezes any *running* CSS animation/transition for the drag duration (the matrix is a point-in-time resolve). This was judged acceptable — arguably desirable — at planning time.
- Reviewer should scrutinize: the empty-string branch (no trailing space), the restore contract (inline-only — class transforms must NOT be baked into inline styles on drop), and that `completeDrag`'s final position still lands correctly for transformed elements.

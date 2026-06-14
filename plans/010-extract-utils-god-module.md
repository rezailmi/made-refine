# Plan 010: Extract one cohesive cluster out of the `src/utils.ts` god module (computed-style getters)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1687d9..HEAD -- src/utils.ts src/utils/`
> If `src/utils.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> line-number mismatch, re-locate the symbols by name (the symbol names are
> stable even if line numbers drift) and continue; on a *signature* mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (one slice; the full god-module split is L and spans several iterations — this plan does exactly one slice)
- **Risk**: MED (23 files import from `./utils`; the barrel re-export must keep every import working)
- **Depends on**: none (recommended: land plan 014 `test:fast` first so the test gate is fast to re-run; not required)
- **Category**: tech-debt
- **Planned at**: commit `c1687d9`, 2026-06-13

## Why this matters

`src/utils.ts` is 3,596 lines with 75 exports imported by 23 files. An earlier
`src/utils/` extraction started (the directory already holds `color.ts`,
`css-value.ts`, `measurements.ts`, `react-fiber.ts`, `resize-geometry.ts`,
`snap-targets.ts`, `element-selection.ts`, `debug-stack.ts`) but **stalled** —
the bulk of the module never moved. A 3,600-line file is hard for both humans
and AI agents to navigate, slow to typecheck in isolation, and a magnet for
merge conflicts. This plan extracts **one** cohesive, low-risk cluster — the
computed-style getter functions — into `src/utils/computed-styles.ts`, keeping
`src/utils.ts` as a barrel that re-exports it so **no importer changes**. It
establishes the repeatable pattern; the remaining clusters follow in later
iterations (see Maintenance notes).

This is a pure code-move with **zero behavior change**. The existing
`src/utils.test.ts` suite is the safety net — it must pass unchanged.

## Current state

- `src/utils.ts` (3,596 lines) — the god module. The cluster to extract is the
  computed-style getters, currently at these locations (names are stable; line
  numbers are as of `c1687d9`):
  - `getComputedStyles` (line ~74)
  - `getComputedBorderStyles` (line ~108)
  - `ORIGINAL_STYLE_PROPS` const (line ~134)
  - `getOriginalInlineStyles` (line ~184)
  - `getComputedTypography` (line ~605)
  - `getComputedSizing` (line ~714)
  - `getComputedBoxShadow` (line ~948)
  - `getComputedColorStyles` (line ~954)
  - `getSelectionColors` (line ~975)
  - `AllComputedStyles` interface (line ~1034)
  - `getAllComputedStyles` (line ~1045) — aggregates the above
- The established extraction pattern: a focused module under `src/utils/` that
  is **re-exported** from `src/utils.ts`. Confirm the existing barrel re-export
  style at the bottom of `src/utils.ts` and in the existing extracted modules
  before moving code. Example existing extracted module: `src/utils/color.ts`
  (with its test `src/utils/color.test.ts`).
- Importers use `import { ... } from './utils'` (23 files). Sample:
  `src/use-style-updaters.ts:19-37` imports `getAllComputedStyles`,
  `getComputedBorderStyles`, `getComputedColorStyles`, `getComputedBoxShadow`,
  `getOriginalInlineStyles` from `'./utils'`. These imports must keep working
  unchanged.
- `src/utils.test.ts` — large existing suite that exercises many of these
  getters (e.g. it manipulates `window.__DIRECT_EDIT_DEVTOOLS__` around lines
  966–1090). It imports from `'./utils'` and must pass unchanged.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install`                            | exit 0              |
| Typecheck | `bunx tsc --noEmit`                      | exit 0, no errors   |
| Targeted tests | `bunx vitest run src/utils.test.ts src/use-style-updaters` | all pass |
| Full gate | `bun run test`                           | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `src/utils/computed-styles.ts` (create — the extracted cluster)
- `src/utils.ts` (remove the moved definitions; add re-exports)

**Out of scope** (do NOT touch, even though they look related):
- Any of the 23 importer files — the whole point is they keep importing from
  `'./utils'` unchanged. If you find yourself editing an importer, STOP.
- The other clusters in `utils.ts` (measurements, drop detection, export
  builders, locator). One slice only — see Maintenance notes for the backlog.
- `src/types.ts` — types referenced by the getters stay where they are and are
  imported by the new module; do not move type definitions.
- Behavior of any function — this is a move, not a refactor. No logic edits.

## Git workflow

- Branch: `advisor/010-extract-computed-styles`
- Commit message (conventional commits, matching `git log`): `refactor: extract computed-style getters from utils god module`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `src/utils/computed-styles.ts` with the moved definitions

Cut (do not copy — the original must be removed in Step 2) these symbols from
`src/utils.ts` into a new file `src/utils/computed-styles.ts`, preserving their
exact implementations:

`getComputedStyles`, `getComputedBorderStyles`, `ORIGINAL_STYLE_PROPS`,
`getOriginalInlineStyles`, `getComputedTypography`, `getComputedSizing`,
`getComputedBoxShadow`, `getComputedColorStyles`, `getSelectionColors`,
`AllComputedStyles` (interface), `getAllComputedStyles`.

Add the imports the moved code needs at the top of the new file. Resolve them
by reading what each function references:
- Types from `'../types'` (e.g. `BorderProperties`, `TypographyProperties`,
  `SizingProperties`, `ColorProperties`, `ColorValue`, `SizingValue`).
- Any helper the getters call that **remains** in `utils.ts` (e.g. color
  parsing, sizing helpers) must be imported from `'../utils'`. **Check for a
  circular-import risk**: if `utils.ts` will re-export `computed-styles.ts`
  AND `computed-styles.ts` imports from `'../utils'`, that is a cycle. To avoid
  it, import shared leaf helpers from their own module if one exists (e.g.
  color helpers from `'./color'`), not from the barrel. If a needed helper
  only exists inside `utils.ts` and has no standalone module, import it
  directly from `'../utils'` — Node/ESM tolerates this cycle for function
  references resolved at call time, but if `tsc` or a test reports a
  runtime `undefined` from the cycle, treat it as a STOP condition.

Keep every symbol `export`ed from the new module.

**Verify**: `bunx tsc --noEmit` → at this point it may still error because
`utils.ts` now has duplicate definitions; that is expected until Step 2. Just
confirm the new file itself has no *import-resolution* errors by reading the
tsc output for `computed-styles.ts` specifically.

### Step 2: Remove the moved definitions from `utils.ts` and re-export

In `src/utils.ts`:
1. Delete the original definitions you moved in Step 1.
2. Add a re-export so importers see no change. Match the existing barrel style
   at the bottom of `utils.ts`. Add:
   ```ts
   export {
     getComputedStyles,
     getComputedBorderStyles,
     ORIGINAL_STYLE_PROPS,
     getOriginalInlineStyles,
     getComputedTypography,
     getComputedSizing,
     getComputedBoxShadow,
     getComputedColorStyles,
     getSelectionColors,
     getAllComputedStyles,
   } from './utils/computed-styles'
   export type { AllComputedStyles } from './utils/computed-styles'
   ```
3. If any code remaining in `utils.ts` *calls* one of the moved getters, add it
   to an `import { ... } from './utils/computed-styles'` at the top of
   `utils.ts` (do not rely on the re-export for internal use).

**Verify**: `bunx tsc --noEmit` → exit 0, no errors. If there are "duplicate
identifier" errors, a definition was left behind; if there are "cannot find
name" errors, an internal caller in `utils.ts` needs the import from step 2.3.

### Step 3: Confirm no behavior change via the existing suite

**Verify**:
- `bunx vitest run src/utils.test.ts` → all pass (unchanged).
- `bunx vitest run src/use-style-updaters` → all pass.
- `bun run test` → full suite passes (508 tests as of `c1687d9`; the count must
  not drop).

### Step 4: Confirm the public surface is identical

**Verify**:
- `git diff c1687d9 -- src/index.ts` → empty (no public-export change).
- `grep -rn "from './utils/computed-styles'" src/` → only `src/utils.ts`
  references it; no importer was rewired.

## Test plan

No new tests. This is a behavior-preserving move; the existing
`src/utils.test.ts` is the regression net. If `src/utils.test.ts` imports a
moved symbol via `'./utils'`, that import continues to resolve through the
re-export — do not change the test's imports. The done criteria require the
existing test count to stay at or above the `c1687d9` baseline.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0; total test count ≥ baseline (508), none removed
- [ ] `src/utils/computed-styles.ts` exists and exports the 10 functions + 1 type listed in Step 2
- [ ] `grep -n "export function getAllComputedStyles" src/utils.ts` returns **no match** (definition moved out)
- [ ] `grep -n "from './utils/computed-styles'" src/utils.ts` returns a match (re-export present)
- [ ] `git diff c1687d9 --name-only` lists only `src/utils.ts`, `src/utils/computed-styles.ts`, and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A moved getter has a runtime dependency cycle that produces `undefined` at
  call time (a test throws `TypeError: x is not a function` after the move).
- Moving the cluster requires editing any importer file to keep types resolving
  (it should not — the barrel re-export covers it).
- The existing `src/utils.test.ts` fails in a way that is not an import path
  issue (i.e. the move changed behavior — it must not).
- `utils.ts` line numbers drifted *and* a symbol's signature no longer matches
  the "Current state" list (the cluster was already partially refactored).

## Maintenance notes

For whoever continues the god-module split (this is slice 1 of several):

- **Remaining clusters in `utils.ts`, in suggested extraction order** (each its
  own future plan, same barrel-re-export pattern):
  1. **Tailwind mapping** — `stylesToTailwind`, `*PropertyToCSSMap`,
     `colorToTailwind`, `sizingToTailwind` → `src/utils/tailwind-mapping.ts`.
  2. **Element info / dimensions** — `getElementInfo`, `getDimensionDisplay`,
     `getElementDisplayName`, `getChildBriefInfo` → `src/utils/element-info.ts`.
  3. **Layout / drop detection** — `isFlexContainer`, `getFlexDirection`,
     `detectChildrenDirection`, `computeIntendedIndex`, `computeHoverHighlight`,
     `findContainerAtPoint`, `findLayoutContainerAtPoint`,
     `calculateDropPosition`, `isLayoutContainer`, `findChildAtPoint` →
     `src/utils/layout-detection.ts` (largest, most interconnected — do last).
  4. **Source / locator** — `getElementSource`, `getElementLocator`,
     `getLocatorHeader`, `formatComponentTree`, `buildElementContext`.
  5. **Export builders** — `buildEditExport`, `buildCommentExport`,
     `buildSessionExport`, `buildMovePlan*`, `getExportContentProfile`,
     `buildExportInstruction`, `collapse*Shorthands` (≈ lines 2554–3567, the
     single biggest slice ~1000 lines) → `src/utils/export-builders.ts`.
- Keep `utils.ts` as a pure barrel as the count of moved clusters grows; the
  end state is a thin re-export file.
- A reviewer should scrutinize: the import graph for cycles (the #1 risk), and
  that `git diff` shows only moves (no logic edits) — a line-level diff of the
  moved bodies against the originals should be character-identical.

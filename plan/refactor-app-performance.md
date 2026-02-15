# Refactoring Plan: made-refine

## Context

The made-refine codebase has grown organically with several maintainability and performance
issues: an abandoned partial refactor left duplicate utility code across two files, two
nearly identical panel components (PaddingInputs/MarginInputs), a verbose Select dropdown
pattern repeated 8+ times, a monolithic React context that triggers unnecessary re-renders,
and a 2,831-line panel file containing 20+ component definitions. This refactoring eliminates
~733 lines of duplication, improves render performance via context splitting, and reorganizes
panel components into a navigable directory structure.

---

## Phase 1: Eliminate Duplicated Utility Code

### 1a. Delete duplicate `src/utils/css-properties.ts`

`src/utils/css-properties.ts` (344 lines) is an abandoned partial refactor containing
exact copies of functions/constants already in `src/utils.ts`:
- `parsePropertyValue`, `formatPropertyValue`, `getComputedStyles`, `getComputedBorderStyles`,
  `getOriginalInlineStyles`, all `*PropertyToCSSMap` constants, `getComputedTypography`,
  `detectSizingMode`, `getSizingValue`, `getComputedSizing`, `sizingValueToCSS`

**Actions:**
1. Update `src/utils/tailwind.ts` line 2: change `import { parsePropertyValue } from './css-properties'`
   to `import { parsePropertyValue } from '../utils'`
2. Delete `src/utils/css-properties.ts`

**Files:** `src/utils/tailwind.ts`, delete `src/utils/css-properties.ts`

### 1b. Extract `getAllComputedStyles` helper

The pattern of calling 6-7 `getComputed*` functions and spreading results into state
appears **7 times** in `src/provider.tsx` (lines 231-236, 560-562, 740-745, 777-782,
815-820, 984-990, 1219-1224).

**Action:** Add to `src/utils.ts`:
```ts
export function getAllComputedStyles(element: HTMLElement) {
  const { spacing, borderRadius, flex } = getComputedStyles(element)
  return {
    computedSpacing: spacing, computedBorderRadius: borderRadius, computedFlex: flex,
    computedBorder: getComputedBorderStyles(element),
    computedSizing: getComputedSizing(element),
    computedColor: getComputedColorStyles(element),
    computedBoxShadow: getComputedBoxShadow(element),
    computedTypography: getComputedTypography(element),
  }
}
```
Replace all 7 call sites in `src/provider.tsx`.

**Files:** `src/utils.ts`, `src/provider.tsx`

---

## Phase 2: Unify Duplicated Panel Components

### 2a. Merge PaddingInputs + MarginInputs into `SpacingInputs`

`PaddingInputs` (lines 163-294) and `MarginInputs` (lines 296-427) in `src/panel.tsx`
are structurally identical — same state, toggle logic, icons, and layout. Only difference
is the key prefix (`padding` vs `margin`).

**Action:** Replace both with a single `SpacingInputs` component accepting a `prefix` prop.
Eliminates ~130 lines.

**Files:** `src/panel.tsx`

### 2b. Extract reusable `SimpleSelect` wrapper

The full `Select > SelectTrigger > SelectPortal > SelectPositioner > SelectPopup > SelectItem`
pattern with identical styling is repeated 8+ times in `src/panel.tsx` (border position,
border style, border side, sizing mode, distribute mode, font family, font weight).

**Action:** Create `src/ui/simple-select.tsx` with a `SimpleSelect` component. Replace
all 8+ instances. Removes ~200 lines of boilerplate. Reuses existing Select primitives
from `src/ui/select.tsx`.

**Files:** Create `src/ui/simple-select.tsx`, update `src/panel.tsx`

---

## Phase 3: Split Provider for Performance

### 3a. Separate actions context from state context

The single `DirectEditContext` spreads `...state` (15+ reactive props) plus 30+ callbacks
into one `useMemo`. Since `state` is a dependency, the entire context recreates on every
state change, forcing all consumers to re-render.

**Action:** Split into two contexts:
- `DirectEditStateContext` — `state` + `sessionEditCount`
- `DirectEditActionsContext` — all callbacks (stable, since they already use `stateRef`)

Keep `useDirectEdit()` backward-compatible by merging both. Add `useDirectEditActions()`
for action-only consumers.

**Files:** `src/provider.tsx`

### 3b. Batch localStorage reads

Two separate mount effects each call `setState` for theme and border preference.

**Action:** Combine into one effect with one `setState` call.

**Files:** `src/provider.tsx`

---

## Phase 4: Extract Panel Sections into `src/panel/`

`src/panel.tsx` is 2,831 lines with 20+ components. Extract into a directory:

| New file | Components | ~LOC |
|----------|-----------|------|
| `src/panel/shared.tsx` | `NumberInput`, `Tip`, `CollapsibleSection`, `SectionNav`, `selectOnFocus` | ~120 |
| `src/panel/spacing-inputs.tsx` | `SpacingInputs` (merged) | ~100 |
| `src/panel/border-radius-inputs.tsx` | `BorderRadiusInputs`, `RadiusCornerIcon` | ~120 |
| `src/panel/border-section.tsx` | `BorderSection`, `BorderInputs`, `BorderSideIcon` | ~200 |
| `src/panel/shadow-section.tsx` | `ShadowSection`, `ShadowLayerEditor`, `ShadowField` | ~160 |
| `src/panel/typography-inputs.tsx` | `TypographyInputs` | ~130 |
| `src/panel/fill-section.tsx` | `FillSection`, `ColorInput` | ~130 |
| `src/panel/sizing-inputs.tsx` | `SizingInputs`, `SizingDropdown`, `SizingFixedInput` | ~130 |
| `src/panel/alignment-grid.tsx` | `AlignmentGrid` | ~80 |
| `src/panel.tsx` (remains) | `DirectEditPanelInner`, `DirectEditPanelContent`, `DirectEditPanel` | ~700 |

**Files:** Create `src/panel/` with 9 files, refactor `src/panel.tsx`

---

## Summary

| Step | Net LOC change |
|------|---------------|
| 1a: Delete duplicate utils | -344 |
| 1b: `getAllComputedStyles` | -55 |
| 2a: Merge spacing inputs | -130 |
| 2b: `SimpleSelect` wrapper | -150 |
| 3a: Split context | -50 |
| 3b: Batch localStorage | -4 |
| 4a: Extract panel sections | ~0 (reorganize) |
| **Total** | **~-733 lines** |

## Verification

1. Run `npx tsc --noEmit` — ensure no type errors after all changes
2. Run existing tests: `npx vitest run` — all tests in `src/provider.test.tsx`,
   `src/utils.test.ts`, `src/toolbar.test.tsx`, etc. should pass
3. Run build: `npx tsup` — verify all 6 build configs succeed
4. Manual smoke test in dev app (`dev/`): toggle edit mode, select elements, modify
   spacing/border/color/typography, undo, export — verify all functionality works

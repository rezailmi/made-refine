# Refactoring Plan: made-refine (DRY-first)

## Goal

Prioritize maintainability and DRY improvements first, then apply performance changes with
clear migration steps so behavior is not regressed and all tests stay green.

## Priorities

1. Remove duplication and reduce file complexity (maintainability first).
2. Preserve runtime behavior and Shadow DOM isolation.
3. Land performance work only after internal APIs are cleaner and easier to reason about.
4. Keep package surface stable where practical; avoid accidental breakage for direct imports.

---

## Phase 0: Safety Baseline (Before Refactor)

1. Run and record baseline:
   - `bunx tsc --noEmit`
   - `bun run build`
   - `bunx vitest run`
2. Capture current behavior for high-risk areas:
   - Select popups render inside shadow root (not `document.body`).
   - Spacing behavior allows negative margins but not negative padding.
   - Existing public exports from `src/index.ts` remain unchanged unless intentionally versioned.

---

## Phase 1: DRY Utility Consolidation

### 1a. Remove duplicate utility implementation safely

`src/utils/css-properties.ts` duplicates logic from `src/utils.ts`.

**Actions:**
1. Create a small shared module (for example `src/utils/css-value.ts`) containing
   `parsePropertyValue` / `formatPropertyValue`.
2. Update both `src/utils.ts` and `src/utils/tailwind.ts` to import from that shared module.
3. Replace duplicate code in `src/utils/css-properties.ts` with a temporary compatibility shim
   (re-exports only), then remove it in a follow-up release.

**Why this order:** avoids coupling `src/utils/tailwind.ts` to the heavy `src/utils.ts` module and
reduces risk of import/bundle side effects.

### 1b. Extract one reusable computed-styles snapshot helper

The provider repeats the same computed style refresh pattern at multiple call sites.

**Actions:**
1. Add `getAllComputedStyles(element)` that returns spacing, border radius, border, flex, sizing,
   color, box shadow, typography from one normalized path.
2. Replace duplicated refresh blocks in `src/provider.tsx`.
3. Keep behavior identical (no functional changes in this phase).

**Files:** `src/utils.ts` (or focused helper module), `src/provider.tsx`

---

## Phase 2: DRY Panel Components

### 2a. Merge `PaddingInputs` + `MarginInputs` into `SpacingInputs`

**Actions:**
1. Replace both components with one `SpacingInputs` component (`prefix: 'padding' | 'margin'`).
2. Include explicit constraints:
   - Padding values clamp to `>= 0`.
   - Margin values allow negatives.
3. Keep current per-component UI behavior (combined vs individual mode) unchanged.

**Files:** `src/panel.tsx` (then moved in Phase 3)

### 2b. Extract `SimpleSelect` without losing variant behavior

**Actions:**
1. Create `src/ui/simple-select.tsx`.
2. Build it as a thin wrapper around existing primitives from `src/ui/select.tsx` only.
3. Support variant props for:
   - `SelectPositioner` options (including `alignItemWithTrigger={false}` cases)
   - trigger/popup/item class differences
   - icon-only and label triggers
4. Replace repeated select markup where patterns truly match.

**Guardrail:** never import `@base-ui/react/select` directly in panel sections; use
`src/ui/select.tsx` wrappers so portals stay in the shadow root.

---

## Phase 3: Extract Panel into `src/panel/` Modules

Split `src/panel.tsx` into focused files after the DRY primitives exist.

| New file | Components |
|----------|-----------|
| `src/panel/shared.tsx` | `NumberInput`, `Tip`, `CollapsibleSection`, `SectionNav`, `selectOnFocus` |
| `src/panel/spacing-inputs.tsx` | `SpacingInputs` |
| `src/panel/border-radius-inputs.tsx` | `BorderRadiusInputs`, `RadiusCornerIcon` |
| `src/panel/border-section.tsx` | `BorderSection`, `BorderInputs`, `BorderSideIcon` |
| `src/panel/shadow-section.tsx` | `ShadowSection`, `ShadowLayerEditor`, `ShadowField` |
| `src/panel/typography-inputs.tsx` | `TypographyInputs` |
| `src/panel/fill-section.tsx` | `FillSection`, `ColorInput` |
| `src/panel/sizing-inputs.tsx` | `SizingInputs`, `SizingDropdown`, `SizingFixedInput` |
| `src/panel/alignment-grid.tsx` | `AlignmentGrid` |

`src/panel.tsx` should remain as composition + exports (`DirectEditPanelInner`,
`DirectEditPanelContent`, `DirectEditPanel`).

---

## Phase 4: Performance Refactor (After Maintainability Cleanup)

### 4a. Stabilize actions first, then split context

**Actions:**
1. Audit callbacks in `src/provider.tsx`; remove state-based dependencies where safe using `stateRef`.
2. Split into:
   - `DirectEditStateContext` (reactive state + `sessionEditCount`)
   - `DirectEditActionsContext` (stable callbacks)
3. Keep `useDirectEdit()` for backward compatibility.
4. Add `useDirectEditState()` and `useDirectEditActions()`.
5. Migrate internal action-heavy consumers first (e.g., toolbar) to `useDirectEditActions()`.

**Important:** context split only helps after consumers stop using merged `useDirectEdit()` for
action-only reads.

### 4b. Batch mount-time localStorage reads

Combine theme and border-style preference initialization into one mount effect with a single
`setState` call.

---

## Verification Gates (Mandatory)

Run this after **every phase**:

1. `bunx tsc --noEmit`
2. `bun run build`
3. `bunx vitest run`

Then run manual smoke checks in `dev/`:

1. Toggle edit mode, select elements, edit spacing/border/color/typography.
2. Verify undo/reset/export/send flows.
3. Verify select popups appear correctly inside shadow-root UI.
4. Verify spacing edge cases: negative margin accepted, padding stays non-negative.
5. Verify theme + border-style preference persistence after reload.

## Done Criteria

1. DRY targets completed (duplicate utility and duplicated panel UI patterns removed).
2. `src/panel.tsx` responsibilities reduced via extracted sections.
3. Performance changes merged only with measurable consumer render reduction.
4. Typecheck, tests, and build all pass on final branch.

# Plan 020: Port Effects controls and flex authoring to standalone

> **Executor instructions**: Port the package-local pieces from DirectCopy plans
> 032 and 034. Skip bridge/protocol versioning and renderer-specific mapping.
>
> **Drift check (run first)**: `git diff --stat 14d4087..HEAD -- src/types.ts src/utils.ts src/utils/computed-styles.ts src/use-style-updaters.ts src/provider.tsx src/panel.tsx src/panel/layout-section.tsx src/panel/typography-inputs.tsx`

## Status

- **State**: DONE
- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 019 for attribution follow-up coverage
- **Category**: editor capability
- **Planned at**: commit `14d4087`, 2026-06-22

## Why this matters

The standalone panel is missing common design-tool controls that DirectCopy
already added: opacity, overflow/clip content, object-fit, italic, text
decoration, text transform, flex-wrap, reverse direction, and a discoverable
"Add flex layout" control.

## Scope

**In scope**: package source under `src/`, especially types, computed readers,
updaters, provider state, panel sections, and tests.

**Out of scope**: DirectCopy `host-bridge.tsx`, `made-refine-protocol`, app
renderer `VisualEditorPanel`.

## Done criteria

- [x] `EffectsSection` exists and is rendered in `DirectEditPanelInner`
- [x] Typography controls include italic/underline/strikethrough/case
- [x] Layout controls include `flexWrap`, reverse direction, and add-flex row
- [x] Tailwind hints cover the new CSS properties
- [x] Targeted panel/provider tests pass

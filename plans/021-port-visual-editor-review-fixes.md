# Plan 021: Port DirectCopy visual-editor review fixes

> **Executor instructions**: Execute after plans 019 and 020. Port only fixes
> that apply to standalone package internals.
>
> **Drift check (run first)**: `git diff --stat 14d4087..HEAD -- src/panel/fill-section.tsx src/panel/shadow-section.tsx src/utils.ts src/utils/tailwind-attribution.ts`

## Status

- **State**: DONE
- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 019, 020
- **Category**: bug / polish
- **Planned at**: commit `14d4087`, 2026-06-22

## Why this matters

DirectCopy review found real follow-up defects in the package layer: layer echo
guards, layer caps, attribution misclassification, missing background shorthand
Tailwind hints, and overflow normalization. Those are still relevant to the
standalone package once the features are ported.

## Done criteria

- [x] Fill and shadow layer editors do not clobber in-flight local state
- [x] Layer add controls honor the editor layer cap
- [x] Attribution does not misclassify border width/text wrapping classes
- [x] Multi-layer fill/background shorthand has an agent-visible hint
- [x] Targeted panel/utils tests pass

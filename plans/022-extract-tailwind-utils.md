# Plan 022: Extract the Tailwind conversion seam from `src/utils.ts`

> **Executor instructions**: This is a move-only refactor after behavior ports.
> Preserve the public `made-refine/utils` export surface.
>
> **Drift check (run first)**: `git diff --stat 14d4087..HEAD -- src/utils.ts src/utils/`

## Status

- **State**: DONE
- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: 019, 020, 021
- **Category**: tech debt
- **Planned at**: commit `14d4087`, 2026-06-22

## Why this matters

`src/utils.ts` is still a high-churn god module. DirectCopy extracted
`stylesToTailwind` and its maps into `src/utils/tailwind.ts`; standalone should
follow after the behavior changes land so future Tailwind edits are isolated.

## Done criteria

- [x] `src/utils/tailwind.ts` owns `stylesToTailwind` and private maps
- [x] `src/utils.ts` re-exports `stylesToTailwind`
- [x] Existing import paths continue to work
- [x] `bunx tsc --noEmit` and targeted utils tests pass

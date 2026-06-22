# Plan 019: Port semantic Tailwind hints and class attribution

> **Executor instructions**: Port only the standalone package pieces from
> DirectCopy plans 018 and 033. Do not add DirectCopy host bridge or Rust DTO
> work.
>
> **Drift check (run first)**: `git diff --stat 14d4087..HEAD -- src/utils.ts src/utils.test.ts src/use-agent-comms.ts src/types.ts`

## Status

- **State**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 018 recommended first
- **Category**: apply quality
- **Planned at**: commit `14d4087`, 2026-06-22

## Why this matters

Standalone still emits arbitrary Tailwind hints for exact preset values
(`w-[64px]`, `text-[14px]`) and gives agents no guidance about replacing
existing classes. DirectCopy already solved this in package code. Porting the
standalone-safe subset improves the edit payload without changing public setup
APIs.

## Scope

**In scope**:

- `src/utils.ts`, `src/utils/tailwind.ts` if extracted by plan 022
- `src/utils/tailwind-attribution.ts` and tests
- `src/use-agent-comms.ts`
- `src/types.ts` payload types if needed

**Out of scope**: DirectCopy `made-refine-protocol`, Rust broker DTOs, Electron
host bridge files.

## Done criteria

- [x] Width/height exact px scale values map to semantic Tailwind utilities
- [x] Font-size exact defaults map to `text-xs` through `text-9xl`
- [x] `sourceClasses` / `variantClasses` are present in edit changes
- [x] Export markdown names existing classes to replace
- [x] Targeted utils/provider tests pass

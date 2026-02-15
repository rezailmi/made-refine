# Agent Knowledge

## Package Surface vs `npx` Setup (2026-02-15)

- The `npx made-refine init` flow wires projects to use `DirectEdit` from `made-refine`, `madeRefine` from `made-refine/vite`, and `made-refine/babel`.
- The scaffolder does not generate imports for `CommentOverlay` or `DirectEditToolbarInner`.
- `CommentOverlay` and `DirectEditToolbarInner` are still publicly exported from package root (`src/index.ts` -> `dist/index.*`), so API changes there can affect advanced/custom consumers who import them directly.
- Practical impact for default `npx init` users: unaffected by prop changes on those two components.
- Practical impact for direct import consumers: may see breaking type/runtime changes.

## Made-Refine Agent Guide

Visual CSS editor for React apps, rendered inside Shadow DOM for CSS isolation.

## Core Architecture

- Build: `tsup` with a custom esbuild plugin for CSS processing.
- Styling: Tailwind CSS v4, injected into the Shadow DOM at runtime.
- UI: `@base-ui/react` components must portal into the shadow root, not `document.body`.

## Implementation Notes

- Preserve Shadow DOM isolation when adding or changing UI/styling behavior.
- If Tailwind classes appear to fail in Shadow DOM, use the documented workaround.

## Reference

- `docs/shadow-dom-tailwind.md` - Shadow DOM + Tailwind v4 workaround and rationale.

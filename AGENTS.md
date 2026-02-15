# Agent Knowledge

## Package Surface vs `npx` Setup (2026-02-15)

- The `npx made-refine init` flow wires projects to use `DirectEdit` from `made-refine`, `madeRefine` from `made-refine/vite`, and `made-refine/babel`.
- The scaffolder does not generate imports for `CommentOverlay` or `DirectEditToolbarInner`.
- `CommentOverlay` and `DirectEditToolbarInner` are still publicly exported from package root (`src/index.ts` -> `dist/index.*`), so API changes there can affect advanced/custom consumers who import them directly.
- Practical impact for default `npx init` users: unaffected by prop changes on those two components.
- Practical impact for direct import consumers: may see breaking type/runtime changes.

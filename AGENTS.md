# Agent Knowledge

## Tooling

- **Package manager**: bun (use `bun run` for scripts, not `pnpm` or `npm`)
- **Build**: `bun run build` — tsup with custom esbuild plugin for CSS processing
- **Test**: `bun run test`

## Architecture

- Visual CSS editor for React apps, rendered inside Shadow DOM for CSS isolation
- **CSS**: Tailwind CSS v4, injected into Shadow DOM at runtime
- **UI**: `@base-ui/react` components portal into shadow root (not `document.body`)

## Reference

- [Module structure](docs/module-structure.md) — provider hooks, panel components, toolbar popovers, and key patterns
- [Shadow DOM + Tailwind v4 workaround](docs/shadow-dom-tailwind.md) — why some Tailwind classes fail in Shadow DOM and how we fix it

## Package Surface vs `npx` Setup

- The `npx made-refine@latest init` flow wires projects to use `DirectEdit` from `made-refine`, `madeRefine` from `made-refine/vite`, and `made-refine/babel`.
- The scaffolder does not generate imports for `CommentOverlay` or `DirectEditToolbarInner`.
- `CommentOverlay` and `DirectEditToolbarInner` are still publicly exported from package root (`src/index.ts` -> `dist/index.*`), so API changes there can affect advanced/custom consumers who import them directly.
- Practical impact for default `npx made-refine@latest init` users: unaffected by prop changes on those two components.
- Practical impact for direct import consumers: may see breaking type/runtime changes.

# CLI (`npx made-refine init`)

The CLI is a single `init` command that installs the package and wires it into the user's project. It runs interactively — every file change is shown as a diff and requires confirmation before being applied.

Entry point: `src/cli.ts` (built to `dist/cli.cjs` via tsup, registered as the `made-refine` bin in package.json).

## What it does

1. **Detect framework** — reads the project's `package.json` dependencies and picks `next`, `vite`, or `tanstack`. If detection fails, prompts the user to choose.
2. **Install the package** — detects the package manager (bun/pnpm/yarn/npm) from lockfiles and `packageManager` field, then runs the appropriate install command.
3. **Apply framework-specific config** — modifies project files to add the `<DirectEdit />` component and any required build config.

## Framework setup

### Next.js

- Copies `dist/preload/preload.js` to `public/made-refine-preload.js`
- Adds `<Script src="/made-refine-preload.js" strategy="beforeInteractive" />` inside `<head>` in `app/layout.tsx`
- Adds `{process.env.NODE_ENV === 'development' && <DirectEdit />}` before `</body>` in the layout

### Vite

- Adds `import { madeRefine } from 'made-refine/vite'` and `madeRefine()` to the plugins array in `vite.config.ts`
- Adds `babel: { plugins: ['made-refine/babel'] }` to the `react()` plugin config
- Adds `{import.meta.env.DEV && <DirectEdit />}` to the root component (`src/App.tsx` or similar)

### TanStack Start

- Same Vite config changes as above
- Adds a lazy-loaded `DirectEdit` import in `src/routes/__root.tsx`
- Wraps it in `<Suspense>` with a `typeof window !== 'undefined'` guard before `</body>`

## Package manager detection

`src/cli-package-manager.ts` detects the package manager in priority order:

1. `packageManager` field in `package.json` (e.g. `"bun@latest"`)
2. Lockfile presence, walking up the directory tree (`bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`)
3. Falls back to `npm`

# Preload (`src/preload.ts`)

The preload script installs a React DevTools hook into the page before React initializes. This gives the overlay access to the React fiber tree, which is used to capture component stack traces and source file locations for every element the user selects.

## Why it must load before React

React checks for `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` at module load time, during renderer injection. If the hook is not present before React's first render, it is never registered and the fiber tree is inaccessible.

The preload script must therefore run as early as possible — before any `import` of React executes. Each framework wires this up differently (see [Framework wiring](#framework-wiring) below).

## What the script does

1. **Wraps or installs the DevTools hook**

   If `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` already exists (e.g. from the React DevTools browser extension), the script wraps it — preserving the existing behavior while adding its own listeners. If no hook exists, it installs a minimal one.

2. **Tracks fiber roots per renderer**

   React calls `hook.inject(renderer)` for each renderer it mounts. The script assigns a stable numeric `rendererId` and maintains a `Map<rendererId, Set<FiberRoot>>`.

3. **Rebuilds the element → fiber index on every commit**

   After each React commit (`onCommitFiberRoot`), the script does a full tree walk and rebuilds a `WeakMap<HTMLElement, Fiber>`. This keeps the index current without retaining stale fiber references.

4. **Exposes `getFiberForElement`**

   ```typescript
   window.__DIRECT_EDIT_DEVTOOLS__.getFiberForElement(element)
   // → Fiber | null
   ```

   `utils.ts` calls this whenever the user selects an element to build the React component stack included in every annotation.

## What the fiber data provides

Each `Fiber` node has:

- **`_debugSource`** — file name, line number, and column number injected by the Babel plugin at build time. This is the most precise way to locate an element in source.
- **`_debugOwner`** — reference to the fiber that created (owns) this element. Walking the owner chain produces the React component hierarchy.

Together these build the `reactStack` and `source` fields in every annotation payload (see [Runner workflow](runner-workflow.md)).

## Framework wiring

### Next.js

The CLI (`npx made-refine init`) copies the IIFE build of the preload script to `public/made-refine-preload.js` and adds a `<Script>` tag to `app/layout.tsx`:

```tsx
<Script src="/made-refine-preload.js" strategy="beforeInteractive" />
```

`strategy="beforeInteractive"` ensures the script runs before any page JavaScript, including the React bundle.

### Vite and TanStack Start

The Vite plugin (`made-refine/vite`) injects the preload script as a `<script>` tag in the HTML `<head>` before the application bundle. The CLI adds the plugin to `vite.config.ts`:

```ts
import { madeRefine } from 'made-refine/vite'

export default defineConfig({
  plugins: [madeRefine(), react({ babel: { plugins: ['made-refine/babel'] } })],
})
```

## Package exports

| Export | Format | Use case |
|---|---|---|
| `made-refine/preload` | ES module | Import in framework-specific entry points |
| `made-refine/preload.iife` | IIFE (`dist/preload/preload.js`) | Direct `<script src>` tag |

## Relationship to the Babel plugin

The preload script reads `_debugSource` data — but that data is only present if the Babel plugin (`made-refine/babel`) was used at build time. The plugin annotates each JSX element with `__source` props during development. Without it, `source` in the annotation payload will be `null`, and the agent falls back to `reactStack` alone to locate the component.

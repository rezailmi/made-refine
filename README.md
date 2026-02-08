# made-refine

> **Beta**: Under active development. API may change.

A visual CSS editor for React. Select any element and adjust padding, border-radius, and flex properties in real-time, then copy as Tailwind classes.

## Get Started

Run this in your project root:

```bash
npx made-refine init
```

The CLI auto-detects your framework (Next.js, Vite, or TanStack Start), installs the package, and configures everything — with a diff preview before any file changes.

Or, paste this prompt into any AI coding assistant (Cursor, Copilot, Claude Code, etc.):

> Add made-refine to this project. Run `npx made-refine init` and follow the prompts.

---

## Manual Setup

If you prefer to set things up by hand, follow the instructions below for your framework.

### Installation

```bash
npm install made-refine@beta
# or
bun add made-refine@beta
# or
yarn add made-refine@beta
```

## Next.js Setup

### 1. Add the Babel plugin (for source locations)

Create `.babelrc` in your project root:

```json
{
  "presets": ["next/babel"],
  "env": {
    "development": {
      "plugins": ["made-refine/babel"]
    }
  }
}
```

### 2. Copy the preload script to public

```bash
cp node_modules/made-refine/dist/preload/preload.js public/made-refine-preload.js
```

### 3. Add the preload script and component

In your root layout (`app/layout.tsx`):

```tsx
import Script from 'next/script'
import { DirectEdit } from 'made-refine'

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {process.env.NODE_ENV === 'development' && (
          <Script src="/made-refine-preload.js" strategy="beforeInteractive" />
        )}
      </head>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <DirectEdit />}
      </body>
    </html>
  )
}
```

## Vite Setup

### 1. Configure vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { madeRefine } from 'made-refine/vite'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [require.resolve('made-refine/babel')],
      },
    }),
    madeRefine(),
  ],
})
```

### 2. Add the component

```tsx
import { DirectEdit } from 'made-refine'

function App() {
  return (
    <>
      <YourApp />
      {import.meta.env.DEV && <DirectEdit />}
    </>
  )
}
```

The Vite plugin automatically injects the preload script in dev mode.

## TanStack Start Setup (SSR / Tauri)

TanStack Start uses SSR, so `DirectEdit` must be lazy-loaded to avoid server-side rendering errors.

### 1. Configure vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { madeRefine } from 'made-refine/vite'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['made-refine/babel'],
      },
    }),
    madeRefine(),
  ],
})
```

### 2. Add to Root Layout

```tsx
import { lazy, Suspense } from 'react'

const DirectEdit = lazy(() =>
  import('made-refine').then((m) => ({ default: m.DirectEdit }))
)

function RootLayout() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
        {import.meta.env.DEV && typeof window !== 'undefined' && (
          <Suspense>
            <DirectEdit />
          </Suspense>
        )}
      </body>
    </html>
  )
}
```

> **Why lazy + Suspense?** TanStack Start renders on the server first. `DirectEdit` uses browser APIs (`window`, `document`, `localStorage`) that don't exist during SSR. `lazy()` prevents the module from loading on the server, `typeof window !== "undefined"` skips rendering during SSR, and `<Suspense>` is required by React for lazy components.

> **Next.js doesn't need this** because it natively supports `'use client'` directives, which the package already includes. Next.js automatically handles the client boundary during SSR.

## Basic Usage

```tsx
import { DirectEdit } from 'made-refine'

function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === 'development' && <DirectEdit />}
    </>
  )
}
```

No CSS import needed - styles are auto-injected at runtime.

### Manual CSS (CSP/SSR)

If your app disallows inline styles, import the stylesheet directly and add `data-direct-edit-disable-styles` to your `<html>` element:

```tsx
import 'made-refine/styles'
import { DirectEdit } from 'made-refine'
```

### Advanced (Custom Setup)

```tsx
import { DirectEditProvider, DirectEditPanel, DirectEditToolbar, useDirectEdit } from 'made-refine'

function App() {
  return (
    <DirectEditProvider>
      <YourApp />
      <DirectEditPanel />
      <CustomToolbar />
    </DirectEditProvider>
  )
}

function CustomToolbar() {
  const { editModeActive, toggleEditMode } = useDirectEdit()

  return (
    <button onClick={toggleEditMode}>
      {editModeActive ? 'Exit Edit Mode' : 'Enter Edit Mode'}
    </button>
  )
}
```

## Features

- **Element Selection**: Click any element to select it (or use `Cmd+.` / `Ctrl+.` to toggle edit mode)
- **Padding Controls**: Adjust padding with combined (horizontal/vertical) or individual mode
- **Border Radius**: Slider for uniform radius or individual corner controls
- **Flex Properties**: Direction, alignment grid, distribution, and gap controls
- **Copy as Tailwind**: One-click copy of modified styles as Tailwind classes
- **Draggable Panel**: Position the panel anywhere on screen (persisted to localStorage)
- **Keyboard Shortcuts**:
  - `Cmd+.` / `Ctrl+.`: Toggle edit mode
  - `Escape`: Close panel or exit edit mode

## Troubleshooting

### Source file locations not showing

Make sure:
1. The Babel plugin is configured in development mode only
2. The preload script loads before React (use `strategy="beforeInteractive"` in Next.js)
3. You're running in development mode, not production

### Styles not appearing

If styles don't load:
- Check for Content Security Policy blocking inline styles
- Import `made-refine/styles` directly and add `data-direct-edit-disable-styles` to `<html>`

### Next.js: "Cannot find module" errors

After installing, restart your dev server to pick up the new Babel config.

### Vite: Preload script not working

Ensure `madeRefine()` plugin is added after `react()` in the plugins array.

## Exports

### Components

- `DirectEdit` - All-in-one component (Provider + Panel + Toolbar)
- `DirectEditProvider` - Context provider for state management
- `DirectEditPanel` - The main editor panel
- `DirectEditToolbar` - Floating toggle button

### Hooks

- `useDirectEdit()` - Access edit state and methods

### Utilities (`made-refine/utils`)

These utilities require DOM APIs and must run in the browser:

- `parsePropertyValue(value: string)` - Parse CSS value to structured format
- `formatPropertyValue(value: CSSPropertyValue)` - Format back to CSS string
- `getComputedStyles(element: HTMLElement)` - Get all editable styles
- `stylesToTailwind(styles: Record<string, string>)` - Convert to Tailwind classes
- `getElementInfo(element: HTMLElement)` - Get element metadata
- `getElementLocator(element: HTMLElement)` - Build element locator for exports

## Requirements

- React 18+
- Next.js 13+ or Vite 4+

## CSS Variables

The package uses CSS variables for theming. It will use your app's existing shadcn/ui theme if available, or fall back to sensible defaults:

- `--background`, `--foreground`
- `--muted`, `--muted-foreground`
- `--border`, `--input`, `--ring`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--accent`, `--accent-foreground`
- `--radius`

## License

MIT

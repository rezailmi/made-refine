# direct-edit

A Figma-style visual CSS editor for React. Select any element and adjust padding, border-radius, and flex properties in real-time, then copy as Tailwind classes.

## Installation

```bash
npm install direct-edit
# or
bun add direct-edit
# or
yarn add direct-edit
```

## Usage

### Simple (Recommended)

```tsx
import { DirectEdit } from 'direct-edit'

function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === 'development' && <DirectEdit />}
    </>
  )
}
```

That's it! No CSS import needed - styles are auto-injected at runtime.

### Manual CSS (CSP/SSR)

If your app disallows inline styles, import the stylesheet directly and disable auto-injection by adding a `data-direct-edit-disable-styles` attribute on your `<html>` element.

```tsx
import 'direct-edit/styles'
import { DirectEdit } from 'direct-edit'

function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === 'development' && <DirectEdit />}
    </>
  )
}
```

### Advanced (Custom Setup)

```tsx
import { DirectEditProvider, DirectEditPanel, DirectEditToolbar, useDirectEdit } from 'direct-edit'

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

## Exports

### Components

- `DirectEdit` - All-in-one component (Provider + Panel + Toolbar)
- `DirectEditProvider` - Context provider for state management
- `DirectEditPanel` - The main editor panel
- `DirectEditToolbar` - Floating toggle button

### Hooks

- `useDirectEdit()` - Access edit state and methods

### Types

- `ElementInfo`
- `CSSPropertyValue`
- `SpacingProperties`
- `BorderRadiusProperties`
- `FlexProperties`
- `DirectEditState`
- `ReactComponentFrame`
- `ElementLocator`

### Utilities

- `parsePropertyValue(value: string)` - Parse CSS value to structured format
- `formatPropertyValue(value: CSSPropertyValue)` - Format back to CSS string
- `getComputedStyles(element: HTMLElement)` - Get all editable styles
- `stylesToTailwind(styles: Record<string, string>)` - Convert to Tailwind classes
- `getElementInfo(element: HTMLElement)` - Get element metadata
- `getElementLocator(element: HTMLElement)` - Build a React + DOM locator payload for exports

### Export Context Format

Exports include a simplified context block derived from the locator utilities:

@<ComponentName>

<element html...>

in /[project]/path/to/component.tsx:12:4

edits:
font-size: 24px (text-[24px])

If file information is unavailable, the export includes lightweight fallback hints:

in (file not available)
selector: div.foo > button:nth-of-type(2)
text: Works

Note: React source file/line/column information is only available in development builds,
so file paths may be unavailable outside dev.

### Client-Only Utilities

Utilities in `direct-edit/utils` rely on DOM APIs (including the locator helpers),
so they must run in the browser.

```ts
import { getDimensionDisplay, stylesToTailwind } from 'direct-edit/utils'
```

### Dev-Only JSX Injection (React 19)

To reliably capture file locations in React 19, inject source metadata into host elements
during development. Add a dev-only Babel config in your app:

```json
// .babelrc
{
  "presets": ["next/babel"],
  "env": {
    "development": {
      "plugins": ["./babel/direct-edit-source.cjs"]
    }
  }
}
```

This plugin adds `data-direct-edit-source="/[project]/path:line:column"` to host elements
in dev, which Direct Edit reads directly from the DOM.

### React 19 Preload Hook (Dev Only)

To resolve file locations in React 19, load a small preload script before React initializes:

```tsx
import Script from 'next/script'

{process.env.NODE_ENV === 'development' && (
  <Script src="/direct-edit-preload.js" strategy="beforeInteractive" />
)}
```

For other frameworks, import `direct-edit/preload` before React mounts.

Build the package to generate the preload asset:

```bash
bun run --cwd packages/direct-edit build
```

Note: Source file/line/column information is only available in development builds.

## Requirements

- React 18+
- Works with any React framework (Next.js, Vite, CRA, etc.)

## CSS Variables

The package uses CSS variables for theming. It will use your app's existing shadcn/ui theme if available, or fall back to sensible defaults:

- `--background`
- `--foreground`
- `--muted`
- `--muted-foreground`
- `--border`
- `--input`
- `--ring`
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--accent`
- `--accent-foreground`
- `--radius`

## License

MIT

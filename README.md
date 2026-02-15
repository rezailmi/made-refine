# handmade

[![npm version](https://img.shields.io/npm/v/made-refine)](https://www.npmjs.com/package/made-refine) [![npm downloads](https://img.shields.io/npm/dm/made-refine)](https://www.npmjs.com/package/made-refine)

Visual CSS editor for React. Edit styles in the browser, then copy agent-ready edits with component and file context.

<p align="center">
  <img src=".github/screenshot.png" alt="handmade visual editor" width="720" />
</p>

- Edit spacing, colors, typography, borders, shadows, and layout visually
- Copies include component name, file path, and the exact changes — ready for Cursor or Claude Code
- One-command setup for Next.js, Vite, and TanStack Start

## Quick start

```bash
npx made-refine init
```

This detects your framework, installs the package, previews file changes, and applies them after your confirmation. No manual wiring needed.

## Usage

1. Start your dev server.
2. Press **Cmd+.** (or **Ctrl+.**) to toggle edit mode.
3. Select an element, adjust styles, then copy edits to your AI agent.

## How it works

- Renders inside Shadow DOM for full CSS isolation from your app
- Babel/Vite plugin adds source location metadata to every JSX element
- Hooks into React DevTools fiber tree for component name resolution
- Built-in MCP server enables hands-free agent workflows

## Supported frameworks

Next.js · Vite · TanStack Start

## License

[MIT](./LICENSE)

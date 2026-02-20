# Made-Refine

Visual CSS editor for React apps, rendered inside Shadow DOM for CSS isolation.

## Tooling

- **Package manager**: bun (use `bun run` for scripts, not `pnpm` or `npm`)
- **Build**: `bun run build` — tsup with custom esbuild plugin for CSS processing
- **Test**: `bun run test`

## Architecture

- **CSS**: Tailwind CSS v4, injected into Shadow DOM at runtime
- **UI**: `@base-ui/react` components portal into shadow root (not `document.body`)

## Reference

- [Module structure](docs/module-structure.md) — provider hooks, panel components, toolbar popovers, and key patterns
- [Shadow DOM + Tailwind v4 workaround](docs/shadow-dom-tailwind.md) — why some Tailwind classes fail in Shadow DOM and how we fix it
- [CLI](docs/cli.md) — `npx made-refine init`, framework detection, and project setup
- [MCP client](docs/mcp-client.md) — browser-to-agent communication protocol for sending edits and comments

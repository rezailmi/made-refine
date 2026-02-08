# Made-Refine

Visual CSS editor for React apps, rendered inside Shadow DOM for CSS isolation.

## Architecture

- **Build**: tsup with custom esbuild plugin for CSS processing
- **CSS**: Tailwind CSS v4, injected into Shadow DOM at runtime
- **UI**: `@base-ui/react` components portal into shadow root (not `document.body`)

## Reference

- [Shadow DOM + Tailwind v4 workaround](docs/shadow-dom-tailwind.md) — why some Tailwind classes fail in Shadow DOM and how we fix it

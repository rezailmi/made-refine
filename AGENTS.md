# Made-Refine Agent Guide

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

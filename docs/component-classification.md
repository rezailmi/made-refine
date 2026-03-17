# Component Classification

Classifies selected elements as **component primitives** (reusable UI building blocks like Button, Input) vs **instances** (app-level components or plain HTML). This drives two behaviors:

1. **Purple overlay** — primitives get a purple selection border instead of blue
2. **Source routing** — primitives point `source:` to the component definition (edits propagate app-wide), instances point to the call site (edits are local)

## Detection flow

```
User selects element (e.g. <div> inside <Button>)
              │
              ▼
   getFiberForElement(div)
              │
              ▼
   React Fiber for host <div>
         │              │
         ▼              ▼
getSourceFromFiber   getOwnerStack
→ _debugSource       → walks _debugOwner chain
→ elementSourceFile  → frames = [Button, App, ...]
  = ".../components/ → nearestComponentFiber
     ui/index.tsx"
         │              │
         └──────┬───────┘
                ▼
  classifyComponentFiber(fiber, frames, elementSourceFile)
                │
   ┌────────────┼────────────────┐
   ▼            ▼                ▼
1. element   2. callSite       3. frames
   source       matches?          any match?
   matches?
   │
   ▼ YES
{ isComponentPrimitive: true }
```

Three checks run in order — first match wins:

1. **`elementSourceFile`** — the host element's `_debugSource.fileName`. Points to the file where the `<div>` JSX is written inside the component. Most reliable signal. Checked before the fiber null guard so it works even when the owner stack is empty.

2. **Call-site source** — the nearest component fiber's `_debugSource`. Points to where `<Button>` is used. Only matches when a primitive is composed inside another primitive file (e.g., Dialog uses Button from the same `/components/ui/` dir).

3. **Stack frames** — iterates `reactStack` frames. Same as call-site but covers ancestor components.

## Path patterns

Classification uses `isComponentPrimitivePath()` in `src/utils/react-fiber.ts`.

**Primitive patterns** (match = primitive):
- `/components/ui/` — shadcn/ui convention
- `/ui/primitives/` — alternative convention
- `/design-system/` — design system packages

**NPM UI library patterns** (match = primitive):
- `@base-ui/`, `@radix-ui/`, `@headlessui/`, `@chakra-ui/`, `@mantine/`, `@mui/`, `@ark-ui/`

**Framework exclusions** (match = NOT primitive, checked first):
- `node_modules/react/`, `node_modules/react-dom/`, `node_modules/next/dist/`, `node_modules/scheduler/`, `node_modules/react-server/`

The broad `/components/` pattern is intentionally excluded — it would false-positive on app components like `src/components/dashboard/revenue-chart.tsx`.

### Limitation: NPM packages

NPM UI libraries typically ship pre-compiled code without `_debugSource`. The NPM patterns only match when the package exposes source paths through source maps in dev mode — uncommon but possible. Detection is most reliable for **user-land components** in `/components/ui/`.

## Data flow to overlay

```
use-session-manager.ts
  → getReactComponentInfo(element)     ← from react-fiber.ts
  → classifyComponentFiber(...)        ← from react-fiber.ts
  → stores isPrimitive in DirectEditState
      │
      ▼
panel.tsx
  → reads isComponentPrimitive from useDirectEditState()
  → passes to <SelectionOverlay isComponentPrimitive={...}>
      │
      ▼
selection-overlay.tsx
  → selectionColor = isPrimitive ? '#8B5CF6' : '#0D99FF'
  → applied to border, dimension label, resize handles
```

## Data flow to export

```
getElementLocator(element)              ← src/utils.ts
  → LOCAL getReactComponentInfo()       ← has _debugStack fallback
  → classifyComponentFiber()            ← from react-fiber.ts
  → returns enriched ElementLocator:
      reactComponentName, authoredProps, isComponentPrimitive,
      callSiteSource, definitionSource, subElementSources
          │
          ├─► buildLocatorContextLines() → text export format
          │     type: component | instance
          │     source: definition (primitives) or call-site (instances)
          │     props: {"variant":"primary"}
          │     react: Button (in App)
          │
          └─► buildLocatorPayload() → agent JSON payload
```

Note: `utils.ts` has its own local fiber-walking functions (not imported from `react-fiber.ts`) because they include a `_debugStack` fallback for React 19 server components. The `react-fiber.ts` versions are used for the overlay path. Both produce the same result on React 18.

## Key files

| File | What |
|------|------|
| `src/utils/react-fiber.ts` | `isComponentPrimitivePath`, `classifyComponentFiber`, `getReactComponentInfo`, `getComponentProps`, `getCallSiteSource`, `deriveDefinitionSource` |
| `src/utils.ts` | `getElementLocator` (enriched), `buildLocatorContextLines` (new format), `getLocatorHeader` (classification-aware source), `collectSubElementSources` |
| `src/use-session-manager.ts` | Computes `isPrimitive` on element selection, stores in state |
| `src/selection-overlay.tsx` | `COMPONENT_PURPLE`, `selectionColor` conditional |
| `src/use-agent-comms.ts` | `buildLocatorPayload` sends classification fields to agent |
| `src/types.ts` | `ElementLocator` type with `isComponentPrimitive`, `callSiteSource`, `definitionSource`, etc. |

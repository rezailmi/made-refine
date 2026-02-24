# Canvas mode: body offset and guideline math

## Problem

Canvas mode applies `transform: scale(zoom) translate(panX, panY)` to `<body>` with `transform-origin: 0 0`. The transform origin is at the body's **border-box** top-left, which sits at `(marginLeft, marginTop)` in the viewport — not `(0, 0)`.

Most browsers apply a default `8px` margin on `<body>`. Unless the app resets it, any coordinate conversion between viewport space and content space must account for this offset.

An element at content position `p` appears at:

```
viewportPos = bodyMargin + (p + pan) * zoom
```

If you omit `bodyMargin`, the error is `bodyMargin * (zoom - 1)` — zero at 1x, 32px at 5x.

Comments are unaffected because they use `getBoundingClientRect()` on the actual DOM element, which inherently includes the body transform and margin.

## Solution

### Body offset state (`canvas-store.ts`)

A module-level `bodyOffset: { x, y }` alongside the existing canvas snapshot. Accessed via `getBodyOffset()` / `setBodyOffset()`.

### Measurement (`use-canvas.ts`)

- **`enterCanvas()`**: After `scrollTo(0,0)`, before applying the transform, measure via `getComputedStyle(document.body).marginLeft/Top`.
- **`exitCanvas()`**: Reset to `{ x: 0, y: 0 }`.

### Coordinate formulas

All formulas use `bo` for the relevant axis of `getBodyOffset()`.

| Operation | Formula |
|---|---|
| **Viewport → stored** (creating/dragging a guideline) | `stored = bo + (viewportPos - bo) / zoom - pan` |
| **Stored → viewport** (rendering a guideline) | `viewportPos = bo + (stored - bo + pan) * zoom` |
| **Zoom-to-cursor** | `newPan = oldPan + (cursor - bo) * (1/newZoom - 1/oldZoom)` |

### Files involved

- `src/canvas-store.ts` — state
- `src/use-canvas.ts` — measurement + zoom-to-cursor
- `src/rulers-overlay.tsx` — rendering (React path + imperative `updateGuidelinePositions`)
- `src/use-guidelines.ts` — storage (`startCreate`, `onPointerMove`, `startDrag`)

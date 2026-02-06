# Move (Drag & Drop)

Drag-and-drop reordering of DOM elements. Elements can be moved between flex containers, grid containers, and block containers.

## Quick start

```tsx
import { useMove, SelectionOverlay, MoveOverlay } from 'made-refine'

function MyEditor() {
  const [selected, setSelected] = useState<HTMLElement | null>(null)

  const { dragState, dropIndicator, startDrag } = useMove({
    onMoveComplete: (el) => setSelected(el),
  })

  return (
    <>
      {selected && (
        <SelectionOverlay
          selectedElement={selected}
          isDragging={dragState.isDragging}
          ghostPosition={dragState.ghostPosition}
          onMoveStart={(e) => startDrag(e, selected)}
        />
      )}
      {dragState.isDragging && (
        <MoveOverlay dropIndicator={dropIndicator} />
      )}
    </>
  )
}
```

## `useMove(options)`

Hook that manages the full drag lifecycle: start, pointer tracking, drop target resolution, and DOM insertion.

### Options

| Prop | Type | Description |
|------|------|-------------|
| `onMoveComplete` | `(element: HTMLElement) => void` | Called after a successful drop. Use it to re-select the moved element or sync state. |

### Return value (`UseMoveResult`)

| Field | Type | Description |
|-------|------|-------------|
| `dragState` | `DragState` | Current drag state: whether dragging, the element, ghost position, original DOM location. |
| `dropTarget` | `UseMoveDropTarget \| null` | Resolved container and insertion point. `null` when not over a valid target. |
| `dropIndicator` | `DropIndicator \| null` | x/y/width/height for rendering the blue drop line. `null` when no target. |
| `startDrag` | `(e: PointerEvent, element: HTMLElement) => void` | Call on `onPointerDown` to begin dragging. |

### Drag lifecycle

1. User presses on a grab handle → call `startDrag(e, element)`.
2. `useMove` sets `isDragging: true`, dims the element (`opacity: 0.5`), records original parent/sibling.
3. On every `pointermove`, the hook updates `ghostPosition` and calls `findContainerAtPoint` to resolve a drop target.
4. On `pointerup`, the hook calls `insertBefore`/`appendChild` to move the element in the DOM, then fires `onMoveComplete`.
5. Pressing `Escape` cancels and snaps the element back.

## `SelectionOverlay`

Renders the blue selection border and a transparent drag handle over the selected element.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `selectedElement` | `HTMLElement` | The currently selected DOM element. |
| `isDragging` | `boolean` | Pass `dragState.isDragging`. Hides the grab handle during drag. |
| `ghostPosition` | `{ x: number; y: number }` | Pass `dragState.ghostPosition`. Moves the outline to follow the cursor. |
| `onMoveStart` | `(e: PointerEvent) => void` | Pass a function that calls `startDrag`. |

The overlay tracks scroll, resize, and mutation changes to keep the border in sync.

## `MoveOverlay`

Renders the blue drop indicator line.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `dropIndicator` | `DropIndicator \| null` | Pass `dropIndicator` from `useMove`. Renders nothing when `null`. |

## Drop target resolution

`findContainerAtPoint(x, y, exclude, preferredParent?)` determines where an element can be dropped.

### Container priority

1. **Preferred parent** — if provided and is a flex container at the cursor point, it wins. This ensures sibling reordering takes priority over nesting into a child.
2. **Flex/grid containers** — `display: flex | inline-flex | grid | inline-grid`. First pass through `elementsFromPoint`.
3. **Block containers** — `display: block | flow-root`. Second pass fallback.

### Non-flex containers

Block containers are treated as vertical (`column`) for drop position calculation. Children are stacked top-to-bottom, and the pointer's Y position determines the insertion point.

## Utility exports

These are available from `made-refine` or `made-refine/utils`:

| Function | Description |
|----------|-------------|
| `isFlexContainer(el)` | Returns `true` if `display` is `flex` or `inline-flex`. |
| `getFlexDirection(el)` | Returns the computed `flex-direction`. |
| `findContainerAtPoint(x, y, exclude, preferredParent?)` | Resolves the best drop container at a viewport coordinate. |
| `calculateDropPosition(container, x, y, draggedEl)` | Returns `{ insertBefore, indicator }` for a given container and pointer position. |
| `elementFromPointWithoutOverlays(x, y)` | Hides the shadow host, calls `elementFromPoint`, restores. Use when the overlay blocks hit-testing. |

## Types

```ts
interface DragState {
  isDragging: boolean
  draggedElement: HTMLElement | null
  originalParent: HTMLElement | null
  originalNextSibling: HTMLElement | null
  ghostPosition: { x: number; y: number }
  dragOffset: { x: number; y: number }
}

interface DropIndicator {
  x: number
  y: number
  width: number
  height: number
}

interface UseMoveDropTarget {
  container: HTMLElement
  insertBefore: HTMLElement | null
  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
}
```

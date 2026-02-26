# TODOs

## Compose existing element transforms during drag

**What:** When dragging an element that already has a CSS transform (e.g. `rotate(45deg)` or `scale(1.2)`), preserve the original transform alongside the drag translate rather than overriding it.

**Why:** Currently, the drag implementation saves `element.style.transform`, sets it to `translate(dx, dy)` during drag, then restores it on drop. An element with an existing transform loses that transform visually while being dragged (it reappears on drop). This is a subtle but noticeable glitch for elements that have CSS animation keyframes, rotations, or scales applied inline.

**Context:** The naive composition `${originalTransform} translate(${dx}px, ${dy}px)` doesn't work because CSS transforms apply right-to-left — the translate would be in the element's rotated/scaled coordinate system, not viewport space. The correct fix is to prepend the translate: `translate(${dx}px, ${dy}px) ${originalTransform}`, but this also has issues because subsequent matrix decomposition in `completeDrag` (which reads `getBoundingClientRect`) needs to account for the element's own scale in the viewport-to-local mapping. The existing `rect.width / offsetWidth` scale factor already handles this case correctly (it includes the element's own scale transform in the ratio), so the math is already right — only the visual during drag is wrong. The fix is to use `translate(dx/scaleX, dy/scaleY) ${originalTransform}` (prepend translate in local/pre-transform space).

**Where to start:** `src/use-move.ts`, `handlePointerMove`. The `originalTransformRef` and scale factors from `initialRectRef` are already in place. Change `translate(${dx}px, ${dy}px)` to `translate(${dx}px, ${dy}px) ${originalTransformRef.current}` (prepend, not append). Add a test with `transform: rotate(45deg)` on the element and verify the element stays visually aligned with the overlay during drag.

**Depends on / blocked by:** The drag-with-transform implementation (merged in the "free move reliability" PR).

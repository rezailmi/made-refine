# TODOs

## Compose existing element transforms during drag

**What:** When dragging an element that already has a CSS transform (e.g. `rotate(45deg)` or `scale(1.2)`), preserve the original transform alongside the drag translate rather than overriding it.

**Why:** Currently, the drag implementation saves `element.style.transform`, sets it to `translate(dx, dy)` during drag, then restores it on drop. An element with an existing transform loses that transform visually while being dragged (it reappears on drop). This is a subtle but noticeable glitch for elements that have CSS animation keyframes, rotations, or scales applied inline.

**Context:** The naive composition `${originalTransform} translate(${dx}px, ${dy}px)` doesn't work because CSS transforms apply right-to-left — the translate would be in the element's rotated/scaled coordinate system, not viewport space. The correct fix is to prepend the translate: `translate(${dx}px, ${dy}px) ${originalTransform}`, but this also has issues because subsequent matrix decomposition in `completeDrag` (which reads `getBoundingClientRect`) needs to account for the element's own scale in the viewport-to-local mapping. The existing `rect.width / offsetWidth` scale factor already handles this case correctly (it includes the element's own scale transform in the ratio), so the math is already right — only the visual during drag is wrong. The fix is to use `translate(dx/scaleX, dy/scaleY) ${originalTransform}` (prepend translate in local/pre-transform space).

**Where to start:** `src/use-move.ts`, `handlePointerMove`. The `originalTransformRef` and scale factors from `initialRectRef` are already in place. Change `translate(${dx}px, ${dy}px)` to `translate(${dx}px, ${dy}px) ${originalTransformRef.current}` (prepend, not append). Add a test with `transform: rotate(45deg)` on the element and verify the element stays visually aligned with the overlay during drag.

**Depends on / blocked by:** The drag-with-transform implementation (merged in the "free move reliability" PR).

## Add test file for `interaction-overlay.tsx`

**What:** 11 event handlers with complex state interactions (drag sessions, marquee, click suppression) and zero test coverage.

**Why:** Would catch Issues 1 and 4 class bugs (suppressClickRef stuck true, missing isStale() guards).

**Context:** The hook installs capture-phase window/document listeners inside a single `useEffect`. All handler state (`dragSession`, `suppressClickRef`, `lastMouseX/Y`) lives in closure locals, so tests need to simulate the full pointer event sequence (down → move → up → click) rather than calling handlers in isolation. The `isStale()` guard checks whether the host element is still connected — tests can simulate staleness by removing the `[data-direct-edit-host]` element from the DOM mid-sequence.

**Where to start:** Test the `handleWindowPointerUp` flow and `isStale()` guards first. Use the existing `provider.test.tsx` test helpers as a reference for dispatching pointer events against the capture-phase overlay.

**Depends on / blocked by:** Nothing — can be started immediately.

## Add test file for `multi-selection-overlay.tsx`

**What:** `getGroupBounds`, `dedupeConnectedElements`, and the resize observer lifecycle are untested.

**Why:** Would catch Issue 2 class bugs (empty array crash in `getGroupBounds`).

**Context:** `getGroupBounds` is a pure function that reduces an array of `DOMRect` into a bounding box — straightforward to unit test with constructed `DOMRect` values. `dedupeConnectedElements` filters by `isConnected` and dedupes by identity, testable by creating detached DOM elements. The `MutationObserver` / `ResizeObserver` lifecycle in the component itself is harder to test in jsdom but the pure helpers cover the most likely crash vectors.

**Where to start:** `getGroupBounds` edge cases (empty array, single rect, overlapping rects). Then `dedupeConnectedElements` with disconnected and duplicate elements.

**Depends on / blocked by:** Nothing — can be started immediately.

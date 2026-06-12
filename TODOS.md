# TODOs

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

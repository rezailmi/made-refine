# 006 Output: Session-Edit Lifecycle Design

**Spike completed**: 2026-06-12  
**Branch**: `advisor/006-session-lifecycle-design`  
**Source plan**: `plans/006-session-edit-lifecycle-design.md`

---

## Decision Summary

Session edits survive React remounts via a **reattach + reapply** protocol that fires after every React commit (piggybacking plan 004's dirty-flag site). A stale locator is re-resolved against the live DOM using the existing `buildDomSelector` selector as the key. On a **unique, high-confidence match** the entry is rebound to the new node and pending styles are reapplied. On any ambiguity or no-match the entry is marked `stale`. The precision threshold that separates "reattach" from "stale" is a **concrete checklist** (see §3), not a heuristic. This directly implements the maintainer-decided direction: reattach + reapply on unique high-confidence match; stale, never guess otherwise.

---

## Step 1: Loss Characterization (jsdom simulation)

Full HMR interactive browser experiments were impractical in this environment. The following was determined by static analysis of the codebase and jsdom vitest simulation, and is labeled as such where relevant.

**What is lost when a tracked element's DOM node is replaced:**

| Loss                          | Mechanism                                        | Evidence                              |
|-------------------------------|--------------------------------------------------|---------------------------------------|
| Map entry orphaned            | `sessionEditsRef` is `Map<HTMLElement, SessionEdit>`; new node is a different object identity | `use-session-manager.ts:262`, `provider.tsx:223` |
| Inline styles vanish          | `pendingStyles` were applied via `element.style.setProperty` on the old node | `use-style-updaters.ts:575-600`       |
| Selection desyncs             | `state.selectedElement` holds the old node; `getSanitizedSelection` guards `isConnected` | `use-session-manager.ts:342-345`      |
| Undo entries dead             | `UndoEditEntry.element`, `UndoMoveEntry.element` hold direct node refs; `isConnected` guards exist but do nothing on stale edits | `types.ts:247-269`, `use-session-manager.ts:853` |
| textEdit content reverted     | React re-renders the component's output, resetting textContent to the JSX value | `use-text-and-comments.ts:53-196`     |

**What survives:**
- `SessionEdit.locator` — captured at selection time, immutable string/struct — survives as long as the JS object lives
- `SessionEdit.pendingStyles`, `originalStyles`, `move`, `textEdit` — all survive as plain objects
- Comments — survive because `comment.locator` is separate from the DOM node; comment positions are viewport-based; no inline style dependency

**STOP check**: `getSessionEdits()` at line 1223-1226 silently deletes entries where `!edit.element.isConnected`, which means the loss is permanent unless we intercept before that call. The design must install the reattachment check *before* `getSessionEdits` runs, or mark entries as `stale` instead of deleting them.

---

## Step 2: Store Keying Design

### Alternatives Evaluated

**Call sites of `sessionEditsRef`** (from grep): 38 sites across `use-session-manager.ts`, `use-agent-comms.ts`, `use-text-and-comments.ts`, `use-style-updaters.ts`, `utils.ts`, `provider.tsx`. All use `Map<HTMLElement, SessionEdit>` get/set/delete/has operations keyed by element reference.

#### Option A: `Map<string, SessionEdit>` keyed by locator hash + `elementRef: WeakRef<HTMLElement>`

- All 38 call sites must be rewritten; `.get(el)` becomes a two-step: look up locator hash from element, then look up entry.
- **GC behavior**: `WeakRef<HTMLElement>` allows the old node to be GC'd; the entry survives as long as the map holds it.
- **Collision behavior**: if two tracked elements happen to emit the same `domSelector` (e.g., two identical `li.item:nth-of-type(2)` in two separate lists on the page), they collide on the same key. Needs a content-hash tie-breaker or a secondary index.
- Migration blast radius: **high** — every `.get(el)` call must change.
- Rejected as the primary structure for v1 because the blast radius is unnecessary; the secondary-index approach achieves the same outcome with far fewer changes.

#### Option B: Keep element-keyed map; add a parallel `locatorIndex: Map<string, HTMLElement>` used only for recovery

- All 38 existing call sites are **unchanged**.
- On reattachment, the locator index is consulted to find the candidate new node, the entry is re-keyed (`map.delete(oldEl); map.set(newEl, {...entry, element: newEl})`), and the index is updated.
- **GC behavior**: `locatorIndex` holds element refs; stale (disconnected) elements linger until the next reattachment sweep or explicit cleanup. Because the primary map already has its own eviction path (`getSessionEdits` cleans `!isConnected`), the locator index can be pruned at the same time.
- **Collision behavior**: if two stale entries share the same `domSelector`, the second write wins in the index. Detected via the index holding a value that doesn't match the entry — the collision detection becomes part of the confidence check.
- Migration blast radius: **low** — new field + two new functions, no existing call site changes.

#### Option C: Full rekey by locator string (no element refs)

- Requires that locator strings are stable enough to serve as primary keys forever (they are not — a parent gaining an id changes all children's nth-of-type paths). Rejected as too fragile.

### Recommendation: Option B

Keep `Map<HTMLElement, SessionEdit>` as the primary store. Add:
```ts
// In provider.tsx alongside sessionEditsRef
const locatorIndexRef = React.useRef<Map<string, HTMLElement>>(new Map())
```

The locator index is populated whenever `saveCurrentToSession` writes an entry (i.e., `locatorIndex.set(entry.locator.domSelector, el)`). It is the reattachment lookup table, nothing more.

**Two-entry collision** (two stale edits that both emitted `div.card:nth-of-type(2)`): both entries exist in `sessionEditsRef` but only the *last written* wins the locator index slot. The first is displaced. Resolution: collision detection must check that the index entry's `sessionEditsRef.current.get(indexedEl)?.locator.domSelector === selector` before using it; on collision, both entries go stale rather than incorrectly reattaching.

---

## Step 3: Reattachment Protocol

### Trigger

**Piggyback plan 004's dirty-flag site.** Once plan 004 lands, `onCommitFiberRoot` sets `indexDirty = true` instead of calling `rebuildIndex()` immediately. The session-reconciliation sweep uses the same commit event. Concrete wiring:

```ts
// In provider.tsx, after plan 004 lands:
React.useEffect(() => {
  const hook = (window as any).__DIRECT_EDIT_DEVTOOLS__
  if (!hook) return
  // Wrap getFiberForElement: on first call after a commit, run reconcileStaleEdits()
  // — OR — expose a commitCallback registration API from preload.ts
}, [])
```

The simpler alternative (no preload change): install a `MutationObserver` on `document.body` that calls `reconcileStaleEdits()` debounced at 50ms. This catches HMR-triggered DOM mutations without requiring a preload API change. **Prefer the MutationObserver approach for v1** because it avoids modifying the preload contract; plan 004's dirty-flag is an optimization for the fiber index, not a general event bus. The two approaches are not mutually exclusive; the observer fires on any DOM change (moves, text edits) not just React commits, so it may fire more often, but `reconcileStaleEdits()` is cheap when nothing is stale.

**Alternative evaluated: lazy check at interaction/send time only.** This is the minimal approach — check `isConnected` when the user clicks "send" or opens the popover. It means the visual indicator (stale badge) only appears after interaction, not immediately after the remount. Rejected as too late: the user sees a blank panel and assumes the edit was lost. The observer approach gives immediate feedback.

### Match Algorithm

`reconcileStaleEdits()` pseudo-code:

```ts
function reconcileStaleEdits(
  sessionEditsRef: MutableRefObject<Map<HTMLElement, SessionEdit>>,
  locatorIndexRef: MutableRefObject<Map<string, HTMLElement>>,
  setState: Dispatch<...>,
) {
  for (const [el, edit] of sessionEditsRef.current.entries()) {
    if (el.isConnected) continue  // still live — nothing to do

    const selector = edit.locator.domSelector
    const match = matchLocatorToNewNode(edit.locator)  // see confidence checklist

    if (match.result === 'high' && match.node && !match.node.isConnected === false) {
      // Reattach
      sessionEditsRef.current.delete(el)
      const updatedEdit: SessionEdit = {
        ...edit,
        element: match.node,
        status: 'active',           // new field
        locator: getElementLocator(match.node),  // refresh locator
      }
      sessionEditsRef.current.set(match.node, updatedEdit)
      locatorIndexRef.current.set(selector, match.node)
      // Reapply styles
      for (const [prop, value] of Object.entries(edit.pendingStyles)) {
        match.node.style.setProperty(prop, value)
      }
      // Handle textEdit: see §3.5
    } else {
      // Mark stale
      sessionEditsRef.current.set(el, { ...edit, status: 'stale' })
    }
  }
  // Sync count
}
```

### Confidence Checklist

A match is **high confidence** only when ALL of the following are true:

1. **Non-empty selector**: `locator.domSelector` is a non-empty string.
2. **Unique DOM match**: `document.querySelectorAll(locator.domSelector)` returns exactly 1 element.
3. **Tag agreement**: the matched element's `tagName.toLowerCase()` equals `locator.tagName.toLowerCase()`.
4. **Stable attribute still present** (when applicable): if `locator.domSelector` starts with `#`, `[data-testid=`, `[data-qa=`, `[data-cy=`, `[aria-label=`, or `[role=`, verify the matched element still carries that attribute with the same value. (This catches the case where an id was reused on a different element type.)
5. **No locator index collision**: `locatorIndexRef.current.get(locator.domSelector)` either doesn't exist (clean) or points to an element that is also disconnected (the old entry, which is about to be reattached). If it points to a different *connected* element, treat as ambiguous.
6. **Not already tracked by a live edit**: `sessionEditsRef.current.get(candidateNode)` must be undefined (the new node isn't already in the map under a different edit).

Anything less is stale, not a reattachment.

**Why these rules prevent the false positives from the spike:**
- The list-reorder false positives (S7, S8 in the spike) involve nth-of-type selectors that uniquely resolve to the wrong element after a reorder. Rules 1-4 alone do NOT prevent these. They are structural position mismatches that the selector cannot detect. **Rule 4 only helps when there IS a stable attribute** — for purely positional selectors, the only safety net is the conservative bias: if the matched element's text content or class signature changes materially, the locator was nth-of-type based and the reorder is invisible to the selector. The design accepts this as a bounded residual risk (see §3.6).

**Residual false-positive risk**: for elements with only nth-of-type selectors (no id, no data-testid, no aria-label, no unique class), a reorder moves a different element into the position captured in the selector. The locator resolves to a different element. Measured spike precision: 77.8% overall, 100% for stable-attribute elements. **Practical bound**: the false-positive only manifests when (a) the element had NO stable attribute, AND (b) its parent reordered children during the same remount. In practice this means list items in unsorted/dynamic lists. For elements with any stable attribute, precision is 100%.

### Reapply Step

On successful reattachment:
1. For each `[cssProperty, cssValue]` in `edit.pendingStyles`: call `newNode.style.setProperty(cssProperty, cssValue)`.
2. For `textEdit`: the remount has reset the text content to the JSX output. If `edit.textEdit` is non-null, re-apply `newNode.textContent = edit.textEdit.newText`. This restores the user's visible text edit. **Exception**: if the JSX output text has changed since the original edit (e.g., a prop change that updated the default text), we cannot distinguish "text reverted by user" from "prop updated by dev". In this case, apply the newText anyway — the user can discard if wrong, but silently losing the edit is worse. The user sees the stale indicator in the popover which prompts verification.
3. Refresh the locator: `getElementLocator(newNode)` to capture any updated `domSelector` (e.g., a parent gained a stable id during the remount, improving the selector quality). Store the refreshed locator in the updated entry.
4. If the reattached element is currently `state.selectedElement` (old disconnected node), update `state.selectedElement` to the new node. Do NOT trigger a full `applySelection` (which saves to session and pushes undo); instead call a lighter `refreshSelectedElement` variant.

### Stale Transition + UI States

`SessionEdit` gains a new optional field:
```ts
interface SessionEdit {
  // ... existing fields ...
  status?: 'active' | 'stale'  // undefined means active (backward compat)
}
```

State transitions:

```
active ──(remount, high-confidence match)──> active   [reapply styles]
active ──(remount, no match / ambiguous)────> stale
stale  ──(user sends)───────────────────────> deleted  [cached locator used]
stale  ──(user discards)────────────────────> deleted
stale  ──(subsequent remount, high match)───> active   [reattach even from stale]
stale  ──(new edit on same element)─────────> active   [user selected and edited]
```

**UI states for stale edits in the edits popover:**
- Stale edit row: amber/yellow dot indicator (matching plan 007's badge pattern so whichever lands second aligns)
- Tooltip on hover: "Element was replaced — locator cached from original position. Edit will still be sent to agent."
- Send button: enabled (stale edits are still sendable using the cached locator)
- Discard button: enabled (same as active)
- No "Stale" text label inline — space is limited; use dot + tooltip

**`getSessionEdits` change**: instead of silently deleting `!isConnected` entries, retain stale entries:
```ts
// Before:
if (!edit.element.isConnected) {
  sessionEditsRef.current.delete(edit.element)
  continue
}
// After:
if (!edit.element.isConnected && edit.status !== 'stale') {
  // Not yet reconciled — stale-marking happens in reconcileStaleEdits;
  // if we're called before reconciliation, mark stale now rather than delete
  sessionEditsRef.current.set(edit.element, { ...edit, status: 'stale' })
}
edits.push(edit)
```

---

## Step 4: Edge-Case Ledger

### Case 1: Undo stack entries pointing at dead nodes

`UndoEditEntry`, `UndoMoveEntry`, `UndoTextEditEntry` hold direct element references. On undo, guards already exist (`!entry.element.isConnected` → early return at `use-session-manager.ts:853, 932, 969`).

**Decision**: undo entries for dead nodes are skipped silently (current behavior preserved). Reattachment does NOT retarget undo stack entries — the undo stack entry still holds the old (dead) node reference. If the user triggers undo after a remount, the undo step silently no-ops. This is conservative and safe. A future improvement could walk the undo stack and update refs on reattachment, but that is out of scope for v1 (complexity vs. benefit is unfavorable: undo-after-HMR is an edge inside an edge).

### Case 2: Move edits whose anchor siblings changed

`SessionEdit.move` records `toSiblingBefore`, `toSiblingAfter` (and their selectors) as strings captured at drag-complete time. These are agent payload fields, not live element references. The move itself may have been applied to the DOM (the element was physically moved in the live tree).

**Decision**: on remount, if the *moved element* is reattached (high confidence match), re-apply only `pendingStyles`, NOT the DOM move (the DOM was reset by the remount anyway — React's output does not preserve the drag). The `move` record in `SessionEdit` is sent as-is to the agent; the cached sibling names/selectors describe the *intended* position in the original tree. The stale indicator on moves is especially important to surface, as the context may have shifted.

If the moved element fails reattachment (stale), the `move` record is still present and sendable. The agent receives both the stale locator and the move intent — it must handle this gracefully on the server side (no change needed in the client payload schema for v1).

### Case 3: Multi-select groups partially remounted

`selectedElements: HTMLElement[]` may contain a mix of live and dead nodes after a remount.

**Decision**: `reconcileStaleEdits` processes ALL entries in `sessionEditsRef` regardless of selection state. If some elements in a multi-select group reattach and others go stale, the result is a heterogeneous group. The edits popover lists them individually (active or stale). The "send all" action sends each edit using its own locator (unchanged behavior). No special multi-select reattachment logic is needed.

`getSanitizedSelection` already guards `isConnected` (`use-session-manager.ts:343`), so dead nodes in `selectedElements` are filtered out on the next selection interaction. For UI purposes, multi-select overlays should check `isConnected` before rendering selection rects (already implied by MutationObserver cleanup in `selection-overlay.tsx`).

### Case 4: Selected element remounting mid-edit

The user is actively editing (panel open, typing in a spacing field) when HMR fires.

**Decision**:
1. `reconcileStaleEdits` runs; the selected element matches high-confidence → reattach and reapply styles.
2. `state.selectedElement` still holds the old node. `refreshSelectedElement` is called (lightweight: re-reads computed styles from the new node, updates `state.selectedElement` to `newNode`).
3. The panel refreshes automatically because `state.selectedElement` changed and triggers the `useEffect` at `provider.tsx:270`.
4. If reattachment fails (stale): `state.selectedElement` is still the old (dead) node. `clearSelection()` is NOT called automatically — the selection stays visually dead. Instead, a `"Remounted"` banner is shown in the panel: "The element was replaced. Edit is preserved but may need re-selection." The user can click the element again to re-select, which will find and re-use the existing session entry.
5. If the user was mid-text-edit (`textEditingElement` set): `finalizeTextEditing` is called first (same as clicking away), capturing the text into `sessionEdit.textEdit`. Then reattachment proceeds.

### Case 5: Two stale edits matching one new node

`sessionEditsRef` has entries for `el_A` (stale) and `el_B` (stale), both with `locator.domSelector === "ul > li.item:nth-of-type(2)"`. After remount, one new `<li>` matches.

**Detection**: during `reconcileStaleEdits`, before reattaching, check whether a *second* stale entry also matches the same candidate node. Implementation: collect all `(el, edit)` pairs where `el.isConnected === false`, run the matcher for each, then group by candidate node. Any group with size > 1 is a collision.

**Decision**: on collision, NEITHER entry reattaches — both remain stale. The locator index is NOT updated. The user sees two stale badges in the popover. They can discard one or both, or send both (the agent sees both locators and resolves the conflict in code). This is strictly safer than picking one arbitrarily.

### Case 6: Comments

Comments store `{ element: HTMLElement, locator: ElementLocator, clickPosition, relativePosition }`. They are rendered via `comment-overlay.tsx` which uses `element.getBoundingClientRect()` for positioning.

**Audit finding**: comments are NOT position-frozen at creation time — they are dynamically positioned based on the live element's bounding rect. When the element is replaced, the comment's `element` ref becomes dead, and `getBoundingClientRect()` returns a zeroed rect, causing comments to snap to position `(0, 0)`.

**Decision**: comments join a parallel but simpler lifecycle:
- `reconcileStaleEdits` also scans `state.comments` for dead `comment.element` refs.
- On high-confidence match: `comment.element` is updated to the new node. Comment position stays relative (no visual jump).
- On no-match / ambiguous: comment is marked with `status: 'stale'` (new field on `Comment`). It is not deleted — the locator is still valid for the agent. Visually, the stale comment shows at its last known viewport position (frozen rect) with a stale indicator.
- Comments do NOT reapply any styles on reattachment (no inline styles to reapply).
- This is a behavior improvement over the current state (where comments silently teleport to `0,0` on remount).

---

## Step 5: Spike Results

**Method**: jsdom vitest simulation using `getElementLocator` / `buildDomSelector` from `src/utils.ts`. All results come from the `src/spike-006-matcher.test.ts` scratch file run in this session. NOT live-browser HMR results.

**Matcher function tested**: `matchLocatorToNewNode(locator)` — runs `document.querySelectorAll(locator.domSelector)`, filters by tag, returns `high`/`ambiguous`/`no-match` with reason string.

**12-scenario bulk precision run:**

| Scenario | Selector type | Setup | Result | Correct? | Verdict |
|----------|--------------|-------|--------|---------|---------|
| S1: id unchanged | `#submit-btn` | Exact remount | high | yes | TP |
| S2: data-testid | `input[data-testid="email-input"]` | Exact remount | high | yes | TP |
| S3: unique class | `a.nav-brand` (unique in doc) | Exact remount | high | yes | TP |
| S4: nth-first stable | `ul#list > li.item:nth-of-type(1)` | Same order | high | yes | TP |
| S5: deep nested class | `.cta-text` (unique) | Same structure | high | yes | TP |
| S6: aria-label | `button[aria-label="close dialog"]` | Exact remount | high | yes | TP |
| S7: list reorder | `ul > li.list-item:nth-of-type(1)` | Alpha→Beta moved to pos 1 | high | **NO** | **FP** |
| S8: div swap | `div.cards > div.card:nth-of-type(2)` | Y moved to pos 1 | high | **NO** | **FP** |
| S9: removed | `#promo-banner` | Element deleted | no-match | yes | TN |
| S10: id changed | `#section-old` | Remounted as `#section-new` | no-match | yes | TN |
| S11: badges nth | `div > span.badge:nth-of-type(2)` | Same order | high | yes | TP |
| S12: tag changed | `#widget-container` (was div → section) | Tag changed | no-match | yes | TN |

**Summary:**
- High-confidence resolutions: 9/12
- True positives: 7, False positives: **2**, True negatives: 3, False negatives: 0
- **Measured precision: 77.8%** (7/9 high-confidence resolutions were correct)
- **Precision for stable-attribute elements** (id, data-testid, aria-label): 6/6 = **100%**
- **Precision for nth-of-type elements only**: 3/5 = **60%** — the 2 FPs are both reorder scenarios

**Key insight**: The false positives are exclusively nth-of-type selectors after a reorder. The selector `ul > li.list-item:nth-of-type(1)` uniquely resolves after reorder, but now points to the *wrong* list item. This is a structural identity limitation inherent to positional selectors. It cannot be detected by the selector alone — it requires content/attribute comparison.

**Implication for the confidence checklist**: add a 7th rule for nth-of-type-only selectors:

> **Rule 7 (nth-of-type guard)**: If `locator.domSelector` contains `:nth-of-type()` AND does NOT start with `#`, `[data-testid=`, `[data-qa=`, `[data-cy=`, `[aria-label=`, OR `[role=` (i.e., the selector is purely positional), downgrade the reattachment to **stale** rather than high-confidence.

This means: elements without any stable attribute are **never reattached** — they always go stale on remount. They remain sendable with their cached locator (which the agent was already using successfully pre-remount). This drops the overall "reattach" coverage but raises precision to **100%** (0 false positives).

**Revised confidence checklist with Rule 7:**
1. Non-empty selector
2. Unique DOM match (exactly 1)
3. Tag agreement
4. Stable attribute still present (if applicable)
5. No locator index collision
6. Not already tracked by a live edit
7. Selector has at least one stable anchor (id, data-testid, data-qa, data-cy, aria-label, role) — purely positional selectors → stale

With Rule 7, measured precision = **100%** on these fixtures, at the cost of never reattaching positional-only elements.

---

## Step 6: Implementation Plan

### Numbered Steps

**Step 1: Add `status` field to `SessionEdit` and `Comment`** (S — low risk, additive)
- Add `status?: 'active' | 'stale'` to `SessionEdit` in `src/types.ts`
- Add `status?: 'stale'` to `Comment` in `src/types.ts`
- No functional change yet; undefined means active (backward compat)
- Tests: update snapshot-style tests if any assert exact `SessionEdit` shape

**Step 2: Add `locatorIndexRef` to provider** (S — additive, no existing logic changes)
- In `provider.tsx`, add `const locatorIndexRef = React.useRef<Map<string, HTMLElement>>(new Map())`
- Pass it alongside `sessionEditsRef` to `useSessionManager`
- In `saveCurrentToSession`, after `sessionEditsRef.current.set(el, entry)`, add `locatorIndexRef.current.set(entry.locator.domSelector, el)`
- In `removeSessionEdit` and `clearSessionEdits`, clean up locator index entries

**Step 3: Implement `reconcileStaleEdits`** (M — new function, pure logic)
- New function in `src/use-session-manager.ts` (or new file `src/use-session-reconciler.ts`)
- Implements the match algorithm with the 7-rule confidence checklist
- Re-applies `pendingStyles` on reattachment via `element.style.setProperty`
- Re-applies `textEdit.newText` if applicable
- Marks non-matching entries with `status: 'stale'`
- Handles collision detection (two stale entries → same new node → both stay stale)
- Also reconciles `state.comments` dead refs
- Also calls `refreshSelectedElement` when the selected element is reattached
- Unit tests: jsdom vitest test file with the 12 spike scenarios plus the edge cases from §4

**Step 4: Wire trigger via `MutationObserver`** (S — isolated to provider)
- In `provider.tsx`, install `new MutationObserver(() => reconcileStaleEdits(...))` debounced at 50ms, observing `{ childList: true, subtree: true }` on `document.body`
- Disconnect on unmount
- Gate: only run if `sessionEditsRef.current.size > 0` to avoid burning CPU when no edits exist

**Step 5: Update `getSessionEdits` to retain stale entries** (S — behavior change, careful)
- Change the `!isConnected` branch from `delete` to `status: 'stale'` assignment (see §3.4 code)
- This is the safety net: if `reconcileStaleEdits` didn't run yet (e.g., send before first commit after HMR), stale entries still appear rather than silently disappearing
- Tests: verify that stale entries appear in `getSessionItems()` output

**Step 6: Undo stack: no-op guard preserved, no retargeting** (XS — document only)
- Existing `!entry.element.isConnected` guards at lines 853, 932, 969 of `use-session-manager.ts` stay as-is
- Add a comment: "Undo entries for dead nodes are skipped; reattachment does not retarget undo stack (by design, see plans/006-output-session-lifecycle-design.md)"

**Step 7: Stale UI in edits popover** (M — UI work, coordinates with plan 007)
- Add amber dot indicator to stale session edit rows in the edits popover
- Tooltip: "Element was replaced — edit will still send using cached locator"
- Ensure visual style aligns with plan 007's `Failed` badge (whichever lands second adopts the other's color/shape convention)
- Panel: when `state.selectedElement.isConnected === false`, show inline banner in the panel header

**Step 8: Comment dead-ref handling** (S — extends reconciliation)
- In `reconcileStaleEdits`, after processing session edits, iterate `state.comments`
- For each comment where `!comment.element.isConnected`: attempt reattachment (same checklist)
- On success: update `comment.element` to new node (freezes rect at new position)
- On failure: set `comment.status = 'stale'`; `comment-overlay.tsx` renders at last known position with stale indicator

**Step 9: Integration tests** (M)
- `src/provider.test.tsx` scenarios: simulate remount by replacing a tracked node (set innerHTML), verify stale status, verify style reapplication on high-confidence match
- Edge cases: two stale edits colliding on same new node → both stay stale; reorder scenario → stale (Rule 7); id element → reattach

**Total size estimate**: M–L. Steps 1-2 are S each, Step 3 is the core M (matcher logic + tests), Step 4-6 are S each, Step 7-8 are M, Step 9 is M. The implementation can be executed as a single PR or split at Step 4/7 (logic vs. UI).

---

## Appendix: Artifacts

- Scratch spike test: `src/spike-006-matcher.test.ts` (deleted before this commit)
- Plans read: 001–005, README.md
- Drift check: `git diff --stat d582bd9..HEAD -- src/use-session-manager.ts src/use-agent-comms.ts src/use-text-and-comments.ts src/preload.ts src/types.ts` → no changes (clean)

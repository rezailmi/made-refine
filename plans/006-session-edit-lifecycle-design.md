# Plan 006: Design the session-edit lifecycle so edits survive remounts (design spike, not a build plan)

> **Executor instructions**: This is a DESIGN plan. Your deliverable is a design
> document plus spike findings — NOT production code changes. You may write
> throwaway prototype code in a scratch branch to validate assumptions, but
> nothing from the spike merges. Follow the steps, honor STOP conditions, and
> update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat d582bd9..HEAD -- src/use-session-manager.ts src/use-agent-comms.ts src/use-text-and-comments.ts src/preload.ts src/types.ts`
> If these files changed materially since planning, read the diffs first — the
> facts below may have moved.

## Status

- **Priority**: P1 (start anytime; implementation follow-up depends on this)
- **Effort**: M (the spike); the implementation it specifies is L
- **Risk**: LOW (spike itself changes no shipped code)
- **Depends on**: none (but read plans 001–005 to avoid designing against code they change)
- **Category**: tech-debt / bug (design phase)
- **Planned at**: commit `d582bd9`, 2026-06-12

## Why this matters

Session edits are stored in `Map<HTMLElement, SessionEdit>` (`src/use-session-manager.ts:262`, shared with `use-agent-comms.ts:71`, `use-text-and-comments.ts:37`, `use-style-updaters.ts:44`). When React replaces a DOM node — HMR, parent re-render with a key change, Suspense, list reorder — two things are lost: the Map entry is orphaned (the new node is a different object), and the inline styles the editor applied lived on the old node, so the visible edit vanishes too. For a dev tool whose primary session runs *alongside hot reload*, this is the single biggest robustness gap in the editing experience.

## Decided direction (maintainer, 2026-06-12 — design within these constraints)

1. **Reattach + reapply on high confidence**: when a tracked element's node is replaced, attempt to re-resolve its locator to the new node. On a **unique, high-confidence match**, rebind the session entry AND reapply `pendingStyles` (and text edit state where applicable) so the edit visibly survives.
2. **Stale, never guess**: if no match or an ambiguous match, keep the edit's data but mark it **stale** — visible as such in the edits popover, still sendable to the agent using its cached locator. Wrong-element reattachment is strictly worse than visible staleness.
3. Aggressive/moderate-confidence reattachment was explicitly rejected.

## Current state (facts gathered during the audit — verify, then build on)

- Write/read sites of the element-keyed map: `use-session-manager.ts` (owner; `saveCurrentToSession` at :300–327 refreshes the locator each time the *selected* element is saved), `use-agent-comms.ts:151` (send uses `sessionEdit.locator`, frozen for non-selected elements), `use-text-and-comments.ts`, `use-style-updaters.ts:595`.
- `getElementLocator` (`src/utils.ts:2386`) already captures: `domSelector` (`buildDomSelector`, :2042 — unique id → stable attrs → class-qualified nth-of-type path), target HTML, context HTML, React component stack + source. These are the raw materials for re-resolution confidence scoring.
- The undo stack (`use-session-manager.ts:847+`) holds direct element references too (`entry.element.isConnected` guards exist) — any redesign must state what happens to undo entries across a remount.
- Comments (`use-text-and-comments.ts`) are also locator-anchored — decide whether they join the same lifecycle or stay as-is (they already survive by being position/locator based; check).
- A remount-detection signal already exists for free: the preload hook sees every commit (`src/preload.ts:85–89` `onCommitFiberRoot`). Plan 004 (if landed) makes this a dirty-flag site — a session-reconciliation trigger could piggyback the same event, debounced. Alternatives to evaluate: `MutationObserver` on tracked elements' parents; lazy checks (`isConnected`) at interaction/send time only.
- Multi-select groups and move edits (`sessionEdit.move`) reference siblings/parents — reattachment must define what happens to a move record whose anchor siblings changed.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install` | exit 0 |
| Tests (baseline understanding) | `bunx vitest run src/provider.test.tsx` | all pass |
| Demo app for spike experiments | `bun run dev:all` | editor + demo running |

## Scope

**In scope**: reading anything; producing `plans/006-output-session-lifecycle-design.md`; throwaway prototype code on a branch that is never merged.

**Out of scope**: merging ANY production code change; modifying plans 001–005; changing the MCP payload schema (note needs, don't change).

## Steps

### Step 1: Reproduce and characterize the loss

In the demo app (`bun run dev:all`), make an edit, then trigger an HMR update of the demo component (edit `src/demo.tsx`). Record precisely what is lost (map entry, inline styles, selection, undo entries) and what survives. Repeat for: list item reorder, conditional unmount/remount. Write the findings table into the output doc.

### Step 2: Design the store keying

Evaluate at least: (a) `Map<string, SessionEdit>` keyed by a stable locator hash with an `elementRef: WeakRef<HTMLElement>` field; (b) keep element-keyed map plus a parallel locator index used only for recovery; (c) full rekey by locator. For each: migration blast radius (count call sites via `grep -n "sessionEditsRef" src/*.ts`), behavior when two edits resolve to the same locator, GC behavior. Recommend one.

### Step 3: Design the reattachment protocol

Define: trigger (commit-hook piggyback vs observer vs lazy — evaluate against plan 004's lazy index), the match algorithm using existing locator fields (selector uniqueness + tag + component-stack/source agreement), the explicit **confidence rule** (what counts as "unique, high-confidence" — make it a checklist, not a vibe), the reapply step (`style.setProperty` loop from `pendingStyles`; what about `textEdit` whose new text the remount may have reverted?), and the stale transition + UI states (edits popover badge; send-with-cached-locator path).

### Step 4: Edge-case ledger

Write explicit decisions for: undo stack entries pointing at dead nodes; move edits whose siblings changed; multi-select groups partially remounted; the selected element itself remounting mid-edit; two stale edits matching one new node; comments.

### Step 5: Spike the riskiest assumption

Prototype ONLY the match algorithm (Step 3) against the demo app's HMR — measure false-positive/false-negative rate on at least: styled list items, a uniquely-id'd element, a deep anonymous div. Numbers go in the doc.

### Step 6: Write the output document

`plans/006-output-session-lifecycle-design.md`: decision summary, the chosen design with diagrams of state transitions (active → stale → reattached/sent/discarded), the edge-case ledger, spike results, and a numbered implementation-plan outline (sized steps an executor plan can be generated from).

**Verify**: the output doc exists; every Step 2–4 question above has an explicit answer in it (grep the doc for "TBD" → no matches).

## Done criteria

- [ ] `plans/006-output-session-lifecycle-design.md` exists, no "TBD" markers
- [ ] Reattachment confidence rule is a concrete checklist
- [ ] Spike false-positive rate for the matcher is measured and stated
- [ ] Edge-case ledger covers all six cases in Step 4
- [ ] No production code modified (`git status` clean apart from plans/)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The element-keyed map has already been redesigned (check `git log --oneline -20 -- src/use-session-manager.ts`).
- Step 1 shows edits actually DO survive HMR in some frameworks (e.g. React Fast Refresh preserving DOM nodes) — the problem may be narrower than assumed; report scope findings before designing.
- The spike shows no locator-based matcher can exceed ~95% precision on lists — escalate: the "reattach" half of the decided direction may need to be narrowed to id/stable-attr elements only.

## Maintenance notes

- The output doc becomes the source of truth for the implementation plan(s); plan 007's stale/failed item UI states should visually align with the stale states designed here.
- If plan 004 landed, reuse its dirty-flag commit signal rather than adding a second hook wrapper.

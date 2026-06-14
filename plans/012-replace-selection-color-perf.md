# Plan 012: Reduce repeated full-subtree `getComputedStyle` scans in `replaceSelectionColor`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1687d9..HEAD -- src/use-style-updaters.ts`
> If `src/use-style-updaters.ts` changed since this plan was written, compare
> the "Current state" excerpt against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Conditional plan**: This is a *profile-first* optimization. Step 0 gates the
> whole plan — if the measurement shows the scan is not actually hot for
> realistic subtrees, STOP and mark the finding REJECTED in the index. Do not
> optimize on speculation.

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: LOW (the change is localized to one helper; behavior must be
  identical — same elements matched, same properties changed)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `c1687d9`, 2026-06-13

## Why this matters

`replaceSelectionColor` (the "select all elements using this color and recolor
them" action) calls `collectMatchingColorProperties`, which walks the entire
selected subtree and calls `window.getComputedStyle(node)` on **every
descendant** to find color matches (`src/use-style-updaters.ts:76-132`). For a
small selection this is fine; for a large subtree (a whole page section) it is
O(descendants) forced style recalculations and can cause a visible hitch. The
backlog flags this as "only worth fixing if profiling shows it hot." This plan
**measures first**, and only if the scan is genuinely expensive, reduces the
work without changing which elements/properties get matched.

## Current state

`src/use-style-updaters.ts:76-132` — `collectMatchingColorProperties(root, target)`:

```ts
function collectMatchingColorProperties(root: HTMLElement, target: ColorValue): Map<HTMLElement, Set<string>> {
  const matches = new Map<HTMLElement, Set<string>>()
  const targetKey = toColorKey(target)
  const nodes = [root, ...Array.from(root.querySelectorAll('*'))]   // <- every descendant

  for (const node of nodes) {
    if (!(node instanceof Element) || !node.isConnected) continue
    const computed = window.getComputedStyle(node)                  // <- forced recalc per node
    const currentTextColor = computed.color
    const nodeMatches = new Set<string>()
    const addIfMatch = (cssProperty, raw, fallbackCurrentColor?) => { ... }
    addIfMatch('background-color', computed.backgroundColor)
    if (hasOwnText(node)) addIfMatch('color', currentTextColor)
    for (const side of BORDER_SIDE_PROPS) { ... addIfMatch(side.cssProperty, ...) }
    if (computed.outlineStyle !== 'none' && parseFloat(computed.outlineWidth) > 0) { addIfMatch('outline-color', ...) }
    if (node instanceof SVGGraphicsElement) { ... }
    if (nodeMatches.size > 0) matches.set(node as HTMLElement, nodeMatches)
  }
  return matches
}
```

- Caller: `useStyleUpdaters` (the hook starting at line 134) exposes
  `replaceSelectionColor`; the panel wires it via
  `onReplaceSelectionColor={replaceSelectionColor}` (`src/panel.tsx:820`).
- `toColorKey`, `parseVisibleColor`, `hasOwnText`, `BORDER_SIDE_PROPS` are
  module-private helpers above the function (lines 49-74).
- The function is **correct today**; this plan must not change its output for
  any input — only reduce redundant work.

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Install   | `bun install`                                        | exit 0              |
| Typecheck | `bunx tsc --noEmit`                                  | exit 0, no errors   |
| Tests     | `bunx vitest run src/use-style-updaters`            | all pass            |
| Full gate | `bun run test`                                       | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `src/use-style-updaters.ts` (the helper only)
- `src/use-style-updaters.test.ts` (create if absent — a characterization test
  pinning the matching behavior so the optimization can't change output)

**Out of scope** (do NOT touch):
- The set of elements matched or properties returned — output must be identical.
- The public `replaceSelectionColor` signature and its callers.
- Any other helper in the file unrelated to the scan.

## Git workflow

- Branch: `advisor/012-replace-color-scan-perf`
- Commit message: `perf: skip getComputedStyle for elements that cannot match in color replace`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0 (GATE): Measure before optimizing

Write a throwaway micro-benchmark (do NOT commit it) that builds a subtree of
~2,000 nested `div`s in jsdom or, better, reason about the real cost: jsdom's
`getComputedStyle` is not representative of a real browser's forced reflow, so
the honest measurement is in a browser. If you cannot run a browser benchmark,
assess by **count**: log `nodes.length` for a realistic worst case (a page
section with hundreds of descendants). Decision rule:
- If realistic selections are bounded to a few hundred elements and there is no
  user-visible hitch, **STOP** and mark this finding REJECTED in
  `plans/README.md` with the rationale "scan bounded; not hot in practice."
- If selections routinely exceed ~1,000 elements or a hitch is observed,
  proceed to Step 1.

**Verify**: record the decision and the node-count basis in your report.

### Step 1: Add a characterization test (pin current behavior)

Create/extend `src/use-style-updaters.test.ts`. Because
`collectMatchingColorProperties` is module-private, test it through the public
`replaceSelectionColor` path OR temporarily export it for the test (additive
`export` is acceptable here — keep it). Construct a small DOM:
- A root with: a child whose `background-color` matches the target, a child
  with matching text `color` and own text, a child with a visible matching
  border, and a non-matching child. Assert the returned map contains exactly
  the matching elements with exactly the matched CSS properties.

This test must pass **before and after** the optimization — it is the guarantee
of no behavior change.

**Verify**: `bunx vitest run src/use-style-updaters` → the new test passes
against the *current* implementation.

### Step 2: Apply the cheapest safe optimization

Pick the lowest-risk reduction that the characterization test still passes:
- **Early skip via cheap pre-filter is unsafe** (color matches require computed
  styles, which need `getComputedStyle`) — do NOT try to guess matches from
  inline attributes; that changes output. Instead:
- **Reduce the candidate set**: `getComputedStyle` is only needed for elements
  that can carry one of the matched properties. SVG handling already branches.
  The dominant cost is the call itself, so the realistic win is **batching the
  read** so the browser does one style-recalc flush rather than interleaving
  reads with anything that could invalidate layout. Confirm the loop does no
  DOM writes between reads (it does not today) — if so, the reads are already
  batched and the only remaining lever is **skipping `getComputedStyle` for
  nodes that cannot match**: e.g. nodes with no box (`display: none` ancestors
  are still walked by `querySelectorAll`). Add a guard that skips
  `getComputedStyle` when the node has zero client rects
  (`node.getClientRects().length === 0`) — a hidden node cannot visually show
  the color. **Verify the characterization test still passes** (hidden nodes
  must not have been contributing matches that the UI relied on; if the test
  fails, this guard is wrong — revert it).

If neither lever yields a measurable improvement, STOP and mark REJECTED.

**Verify**: `bunx vitest run src/use-style-updaters` → characterization test
still passes (identical matches).

### Step 3: Full gate

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run test` → all pass.

## Test plan

The characterization test from Step 1 is the deliverable test — it pins the
exact match output (elements + properties) so any optimization that changes
behavior fails it. Cover: background match, text-color match (with `hasOwnText`
true vs false), border match (visible vs `border: none`), outline match,
non-matching element excluded. Pattern: construct DOM with
`document.createElement` + inline styles, `afterEach` cleanup, model on
`src/utils/resize-geometry.test.ts` for structure.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `src/use-style-updaters.test.ts` exists with a characterization test that
      pins `collectMatchingColorProperties` output
- [ ] `bun run test` exits 0; new test passes against the final implementation
- [ ] Either: the optimization landed AND the characterization test proves
      identical output; OR the plan is marked REJECTED in `plans/README.md`
      with the profiling rationale
- [ ] No behavior change to which elements/properties are matched
- [ ] `plans/README.md` status row updated (DONE or REJECTED)

## STOP conditions

Stop and report back (do not improvise) if:

- Step 0 shows the scan is not hot → mark REJECTED, do not optimize.
- The `getClientRects().length === 0` guard changes the characterization test
  output (hidden nodes were contributing intended matches) → revert it.
- Any optimization requires changing the matched-property logic to gain speed
  → that is a behavior change; not allowed here.
- The current excerpt does not match the live code (drift).

## Maintenance notes

- If this stays REJECTED, leave a one-line note in `plans/README.md` so it is
  not re-audited.
- If a future feature lets users recolor across very large DOM trees (e.g.
  whole-page theming), revisit with a real browser profile — the right fix then
  may be chunking the scan across animation frames rather than micro-skips.
- A reviewer should scrutinize the characterization test most of all: the
  correctness guarantee lives there, not in the optimization.

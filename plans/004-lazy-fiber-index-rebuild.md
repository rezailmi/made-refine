# Plan 004: Rebuild the preload fiber index lazily instead of on every React commit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d582bd9..HEAD -- src/preload.ts`
> If the file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `d582bd9`, 2026-06-12

## Why this matters

The preload script installs a React DevTools hook in the consumer's app and maintains a `WeakMap<HTMLElement, Fiber>` so the overlay can map a clicked DOM node to its fiber. Today, `onCommitFiberRoot` calls `rebuildIndex()` — a full walk of **every fiber tree** — on **every React commit** (`src/preload.ts:85–89`, and again in the `wrapHook` path at `:114–121`). In an app that commits frequently (typing in a controlled input, animations, polling state), made-refine burns a full-tree traversal per keystroke/frame in the host app, even when the editor overlay is completely idle. The index is only ever read in one place — `getFiberForElement`, called when the user interacts with the editor — so the rebuild can be deferred to first read after a commit (dirty flag). Same total work in the worst case, but zero overhead while the developer is just using their app.

## Current state

- `src/preload.ts` (~165 lines) — standalone script, built both as an importable module and as an IIFE (`dist/preload/preload.js`, see `package.json` exports `./preload` and `./preload.iife`). It must stay dependency-free and side-effect-driven (`installHook()` runs at module load).
- The index and rebuild (lines 30–67):

```ts
const fiberRoots = new Map<number, Set<FiberRoot>>()
let elementToFiber = new WeakMap<HTMLElement, Fiber>()
...
function rebuildIndex() {
  elementToFiber = new WeakMap<HTMLElement, Fiber>()
  for (const roots of fiberRoots.values()) {
    for (const root of roots) {
      const current = root?.current
      if (!current) continue
      indexFiberTree(current)
    }
  }
}
```

- The read path (lines 69–71):

```ts
function getFiberForElement(element: HTMLElement): Fiber | null {
  return elementToFiber.get(element) ?? null
}
```

- The two commit hooks that call `rebuildIndex()` eagerly:
  - `createHook()` path, lines 85–89: `onCommitFiberRoot(id, root) { ... roots.add(root); rebuildIndex() }`
  - `wrapHook()` path (when React DevTools is also installed), lines 114–121: `existing.onCommitFiberRoot = (id, root, ...args) => { ... rebuildIndex(); originalCommit?.(...) }`
- `onCommitFiberUnmount` is a deliberate no-op with the comment "Rebuild on next commit" — that semantic is preserved by the lazy approach.
- The consumer-facing API (lines ~140–158): `window.__DIRECT_EDIT_DEVTOOLS__ = { getFiberForElement, hasHook: true }`. `src/utils/react-fiber.ts:19–24` reads this global. The function's signature and behavior contract must not change.
- There is **no existing test file for preload.ts**. The module is jsdom-safe (guards on `typeof window === 'undefined'`).

## Commands you will need

| Purpose   | Command                                 | Expected on success |
|-----------|-----------------------------------------|---------------------|
| Install   | `bun install`                           | exit 0              |
| Typecheck | `bunx tsc --noEmit`                     | exit 0, no errors   |
| Targeted tests | `bunx vitest run src/preload.test.ts` | all pass         |
| Full gate | `bun run test` (runs a full build first) | all pass           |

## Scope

**In scope** (the only files you should modify):
- `src/preload.ts`
- `src/preload.test.ts` (create)

**Out of scope** (do NOT touch):
- `src/utils/react-fiber.ts` — consumes the global; no contract change.
- `tsup.config.ts` / build outputs — entry already configured.
- Any attempt to make the rebuild *incremental* (per-root diffing). That is a bigger change with correctness risk; this plan only moves the existing full rebuild off the commit path.

## Git workflow

- Branch: `advisor/004-lazy-fiber-index-rebuild`
- Commit message: `perf: rebuild preload fiber index lazily on first lookup`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write characterization tests FIRST (against current behavior)

Create `src/preload.test.ts`. Because `installHook()` runs at import and is guarded by `window.__DIRECT_EDIT_DEVTOOLS__?.hasHook`, import the module dynamically inside the test after preparing `window`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: any
    __DIRECT_EDIT_DEVTOOLS__?: any
  }
}

beforeEach(() => {
  delete window.__REACT_DEVTOOLS_GLOBAL_HOOK__
  delete window.__DIRECT_EDIT_DEVTOOLS__
  // vitest module cache: use vi.resetModules() so each test re-runs installHook()
})
```

Build a minimal fake fiber tree: fiber nodes are plain objects `{ stateNode, child, sibling, return }`; host fibers have `stateNode` set to a real `document.createElement('div')` (nodeType 1). A fake root is `{ current: rootFiber }`.

Tests:
1. **Lookup after commit**: import preload (`await import('./preload')` after `vi.resetModules()`), grab `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`, call `hook.inject({})` → id, call `hook.onCommitFiberRoot(id, fakeRoot)`, then `window.__DIRECT_EDIT_DEVTOOLS__.getFiberForElement(el)` returns the host fiber whose `stateNode` is `el`.
2. **Unknown element** → returns `null`.
3. **Re-commit reflects new tree**: commit root A (element X indexed), then commit a *mutated* root (same root object, `current` now pointing at a tree containing element Y, not X) → lookup(Y) returns Y's fiber.
4. **wrapHook path**: pre-set `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` to a stub `{ inject: () => 1, onCommitFiberRoot: vi.fn() }` before importing; after import, calling `onCommitFiberRoot` indexes elements AND still calls the original stub.

**Verify**: `bunx vitest run src/preload.test.ts` → all 4 pass against the CURRENT (eager) implementation. Do not proceed until they do — these tests define the contract the refactor must preserve.

### Step 2: Make the rebuild lazy

In `src/preload.ts`:

1. Add module state next to the index: `let indexDirty = true`.
2. In both `onCommitFiberRoot` implementations (createHook at ~85 and wrapHook at ~114), replace the `rebuildIndex()` call with `indexDirty = true`.
3. Change the read path:

```ts
function getFiberForElement(element: HTMLElement): Fiber | null {
  if (indexDirty) {
    rebuildIndex()
    indexDirty = false
  }
  return elementToFiber.get(element) ?? null
}
```

No other behavior changes. `rebuildIndex` itself is untouched.

**Verify**: `bunx tsc --noEmit` → exit 0, then `bunx vitest run src/preload.test.ts` → all 4 characterization tests still pass unchanged.

### Step 3: Add a laziness test

Add a 5th test proving commits no longer pay the walk: after an initial lookup (index clean), spy on tree traversal indirectly — commit a root whose `current` getter increments a counter (`get current() { count++; ... }`). Assert the counter does NOT increase on `onCommitFiberRoot` alone, and DOES increase after the next `getFiberForElement` call.

**Verify**: `bunx vitest run src/preload.test.ts` → 5 tests pass.

### Step 4: Full gate

**Verify**: `bun run test` → all pass (this also rebuilds `dist/preload/preload.js`, confirming the IIFE build still compiles).

## Test plan

Covered by Steps 1 and 3: four characterization tests written before the change (lookup after commit, unknown element, re-commit freshness, wrapHook passthrough) plus one laziness test. Pattern: self-contained jsdom vitest file; nearest exemplar for fake-fiber object shape is `src/utils/react-fiber.test.ts` (it builds plain-object fibers).

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0; `src/preload.test.ts` exists with ≥5 passing tests
- [ ] `grep -n "rebuildIndex()" src/preload.ts` shows exactly one call site — inside `getFiberForElement` (the function definition itself doesn't count)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/preload.ts` no longer matches the excerpts (drift).
- The Step 1 characterization tests cannot be made to pass against the CURRENT code after two attempts — the contract assumption is wrong; report what actually happens.
- You discover another consumer of `elementToFiber` or `rebuildIndex` besides `getFiberForElement` (grep first: `grep -n "elementToFiber\|rebuildIndex" src/preload.ts`) — the laziness analysis assumed a single read path.
- vitest module-reset gymnastics (`vi.resetModules` + dynamic import) prove unworkable for a side-effectful module after two attempts — report; do not restructure `installHook()` to be export-driven, as that changes the shipped IIFE behavior.

## Maintenance notes

- If a future feature reads the index on a hot path (e.g. hover-highlight on every mousemove), the first read after each commit will pay the full rebuild — at that point an incremental per-root index (only re-walk the committed root) is the follow-up, and `fiberRoots` is already keyed per renderer to support it.
- Reviewer should scrutinize: the wrapHook path (when real React DevTools is installed) — both the dirty flag AND the original DevTools callback must run.
- Version-skew note (from audit, deferred): `window.__DIRECT_EDIT_DEVTOOLS__` has no protocol version field; if its shape ever changes, add `version: N` and a check in `src/utils/react-fiber.ts`.

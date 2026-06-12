# Plan 005: Include memo()/forwardRef() components in the extracted component stack

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d582bd9..HEAD -- src/utils/react-fiber.ts src/utils/react-fiber.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug (context-extraction accuracy)
- **Planned at**: commit `d582bd9`, 2026-06-12

## Why this matters

made-refine's core value is sending an AI agent enough context to find the right source code for a visual edit. The React component stack (component names + source locations, walked via fiber `_debugOwner`/`return` chains) is a central part of that payload. `buildFrame()` in `src/utils/react-fiber.ts` derives a frame's name from `type.displayName || type.name` — but components wrapped in `React.memo()` or `React.forwardRef()` have an **object** type (`{ $$typeof: Symbol(react.memo), type: inner }` / `{ $$typeof: Symbol(react.forward_ref), render: inner }`) whose `.name` is `undefined`. Unless the author manually set `displayName`, `buildFrame` returns `null` and the frame is **silently dropped from the stack**. Design-system components are very commonly wrapped in `memo`/`forwardRef` (every shadcn/Radix-style `forwardRef` button, every memoized list row), so the agent loses exactly the frames it most needs, and downstream classification (`classifyComponentFiber`, which iterates `frames`) sees fewer file paths to match against primitive patterns.

## Current state

- `src/utils/react-fiber.ts` (~335 lines) — fiber inspection utilities. All fiber access is intentionally `any`-typed (undocumented React internals).
- The dropping happens in `buildFrame` (lines ~65–86):

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFrame(fiber: any): ReactComponentFrame | null {
  const type = fiber?.type
  if (typeof type !== 'function' && typeof type !== 'object') return null

  const name = type?.displayName || type?.name || null
  if (!name || name === 'Fragment') return null

  const frame: ReactComponentFrame = { name }
  const source = getSourceFromFiber(fiber)
  ...
}
```

Object types pass the first check, then fail the name check (memo/forwardRef wrappers have no `.name`), so the frame is dropped. `getSourceFromFiber(fiber)` (line ~40) is independent of the type and would often still yield a file/line — that information is currently thrown away with the frame.

- `buildFrame` is called from `getOwnerStack` (line ~110) and `getRenderStack` (line ~133); both feed `getReactComponentInfo` → `getReactComponentStack` (exported, line ~178), which the locator/payload code consumes.
- React's wrapper shapes (stable since React 16.8, unchanged in 18/19):
  - `forwardRef(fn)` → `{ $$typeof: Symbol.for('react.forward_ref'), render: fn }`
  - `memo(Comp)` → `{ $$typeof: Symbol.for('react.memo'), type: Comp, compare }` — note `memo(forwardRef(fn))` nests: `type` is the forward_ref object.
  - Lazy: `{ $$typeof: Symbol.for('react.lazy') }` — OUT of scope (no resolved name available synchronously; leave dropped).
- Test exemplar: `src/utils/react-fiber.test.ts` (374 lines) builds plain-object fake fibers and tests exported helpers directly — follow its style. It currently imports: `isComponentPrimitivePath, getComponentProps, getCallSiteSource, deriveDefinitionSource, classifyComponentFiber, getSourceFromFiber`.
- `buildFrame` is **not exported**. To keep the change testable, this plan exports a new pure helper and keeps `buildFrame` private.

## Commands you will need

| Purpose   | Command                                            | Expected on success |
|-----------|----------------------------------------------------|---------------------|
| Install   | `bun install`                                      | exit 0              |
| Typecheck | `bunx tsc --noEmit`                                | exit 0, no errors   |
| Targeted tests | `bunx vitest run src/utils/react-fiber.test.ts` | all pass        |
| Full gate | `bun run test` (runs a full build first)           | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/utils/react-fiber.ts`
- `src/utils/react-fiber.test.ts`

**Out of scope** (do NOT touch):
- `src/utils/debug-stack.ts` — React 19 `_debugStack` parsing is a separate mechanism.
- `src/preload.ts` — index building doesn't filter by type.
- `classifyComponentFiber` / `isComponentPrimitivePath` — they consume frames; improving frame coverage helps them without modification.
- `shouldIncludeFrame` dedup logic — unchanged; it operates on already-built frames.

## Git workflow

- Branch: `advisor/005-unwrap-memo-forwardref`
- Commit message: `fix: resolve component names through memo/forwardRef wrappers in stack extraction`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add an exported unwrap helper

In `src/utils/react-fiber.ts`, above `buildFrame`, add:

```ts
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref')
const REACT_MEMO_TYPE = Symbol.for('react.memo')

/**
 * Resolve a displayable component name through memo()/forwardRef() wrappers.
 * Walks at most a few levels (memo(forwardRef(fn))). Returns null when no
 * name can be derived (anonymous wrappers, lazy, host components).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveComponentName(type: any): string | null {
  let current = type
  for (let depth = 0; depth < 4 && current != null; depth++) {
    const name = current.displayName || (typeof current === 'function' ? current.name : undefined)
    if (name) return name
    if (typeof current !== 'object') return null
    if (current.$$typeof === REACT_MEMO_TYPE) { current = current.type; continue }
    if (current.$$typeof === REACT_FORWARD_REF_TYPE) { current = current.render; continue }
    return null
  }
  return null
}
```

Subtlety the loop already handles: a wrapper's own `displayName` (e.g. `memo` object with `displayName = 'FancyList'`) wins over the inner function's name; plain objects that aren't React wrappers return null exactly as before.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Use it in `buildFrame`

Replace the name derivation line:

```ts
  const name = resolveComponentName(type)
  if (!name || name === 'Fragment') return null
```

(The `typeof type !== 'function' && typeof type !== 'object'` early return above it stays.)

**Verify**: `bunx vitest run src/utils/react-fiber.test.ts` → all existing tests pass (no existing test asserts memo/forwardRef frames are dropped; if one does, that test encodes the bug — update it and say so in your report).

### Step 3: Add tests

In `src/utils/react-fiber.test.ts`, add a `describe('resolveComponentName', ...)` block (import the new export):

1. Plain function `function Button() {}` → `'Button'`.
2. `displayName` wins: `const f = () => null; f.displayName = 'Styled(Button)'` → `'Styled(Button)'`.
3. forwardRef shape: `{ $$typeof: Symbol.for('react.forward_ref'), render: function Button() {} }` → `'Button'`.
4. memo shape: `{ $$typeof: Symbol.for('react.memo'), type: function Row() {} }` → `'Row'`.
5. Nested `memo(forwardRef(fn))`: memo object whose `type` is a forward_ref object whose `render` is `function Input() {}` → `'Input'`.
6. Wrapper displayName beats inner name: memo object with `displayName = 'MemoRow'` wrapping `function Row() {}` → `'MemoRow'`.
7. Anonymous forwardRef (`render: () => null` with no name) → `null`.
8. Non-React object `{}` → `null`; string type `'div'` → `null` (host elements never reach buildFrame with this, but the helper should be total).

Then one integration-level test through an exported stack function if feasible with fake fibers: build a fake fiber whose `type` is a forwardRef object and whose `_debugOwner` chain is empty, plus a host child — and assert via `getReactComponentInfo`-reachable behavior **only if** the existing test file already tests those exports with fake fibers AND `getFiberForElement`'s `window.__DIRECT_EDIT_DEVTOOLS__` global can be stubbed (`window.__DIRECT_EDIT_DEVTOOLS__ = { getFiberForElement: () => fakeFiber, hasHook: true }`). If the existing file has no such pattern, the 8 unit tests above are sufficient — do not invent new test infrastructure.

**Verify**: `bunx vitest run src/utils/react-fiber.test.ts` → all pass including new tests.

## Test plan

The 8 unit cases in Step 3 (happy paths, both wrapper shapes, nesting, displayName precedence, anonymous/null fallbacks), modeled structurally on the existing `describe` blocks in `src/utils/react-fiber.test.ts`. Verification: `bun run test` → all pass.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0; ≥8 new `resolveComponentName` tests pass
- [ ] `grep -n "type?.displayName || type?.name" src/utils/react-fiber.ts` → no matches (old derivation replaced)
- [ ] `resolveComponentName` is exported from `src/utils/react-fiber.ts`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `buildFrame` no longer matches the excerpt (drift).
- Existing tests fail in a way that suggests frames for wrapper components were *intentionally* excluded (e.g. a test named around suppressing memo wrappers) — that's a product decision.
- You find the same `displayName || name` derivation duplicated elsewhere in `src/utils/react-fiber.ts` or `src/utils.ts` (grep: `grep -rn "displayName || " src/`) feeding the agent payload — fixing one copy and not the other would make stack and classification disagree. Report the second site instead of expanding scope.

## Maintenance notes

- React 19 keeps these `$$typeof` symbols; if a future React changes wrapper internals, `resolveComponentName` degrades to the old behavior (frame dropped), never crashes — keep it that way.
- Follow-up explicitly deferred: `React.lazy` components (no synchronous name) and production-minified names (single-letter `type.name`) still produce poor frames; the latter needs a different strategy (source-map or path-based naming) and is tracked in the audit backlog, not here.
- Reviewer should scrutinize: precedence (wrapper `displayName` > inner name) and the depth cap.

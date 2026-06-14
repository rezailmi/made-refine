# Plan 015: Add a protocol `version` field to the preload DevTools hook

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1687d9..HEAD -- src/preload.ts src/utils/react-fiber.ts`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (additive field; consumers already feature-detect)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `c1687d9`, 2026-06-13

## Why this matters

The preload script installs `window.__DIRECT_EDIT_DEVTOOLS__` — the bridge the
main bundle uses to read React fiber internals. It loads **before React** and is
shipped/loaded independently of the main package (see `docs/preload.md`), so the
preload and the consumer can be at different versions in a user's app. The hook
object today carries `{ getFiberForElement, hasHook }` with **no version
marker**. If its shape ever changes (a new method, a changed signature), the
consumer has no way to detect which protocol it's talking to and must guess from
method presence. Adding a `version` integer now — before any breaking change —
gives future code a cheap, explicit compatibility check. Plan 004's maintenance
note already flagged this.

## Current state

- `src/preload.ts` — installs the hook (lines ~139-159):
  ```ts
  function installHook() {
    if (typeof window === 'undefined') return
    const globalWindow = window as Window & {
      __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook
      __DIRECT_EDIT_DEVTOOLS__?: { getFiberForElement: (element: HTMLElement) => Fiber | null; hasHook: boolean }
    }
    if (globalWindow.__DIRECT_EDIT_DEVTOOLS__?.hasHook) return
    const existing = globalWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__
    if (existing) { wrapHook(existing) } else { globalWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createHook() }
    globalWindow.__DIRECT_EDIT_DEVTOOLS__ = {
      getFiberForElement,
      hasHook: true,
    }
  }
  ```
- `src/utils/react-fiber.ts` — the consumer (lines ~5-24):
  ```ts
  declare global {
    interface Window {
      __DIRECT_EDIT_DEVTOOLS__?: {
        getFiberForElement: (element: HTMLElement) => unknown | null
        hasHook?: boolean
      }
    }
  }
  export function getFiberForElement(element: HTMLElement): any | null {
    if (typeof window !== 'undefined') {
      const devtools = window.__DIRECT_EDIT_DEVTOOLS__
      if (devtools?.getFiberForElement) {
        const fiber = devtools.getFiberForElement(element)
        if (fiber) return fiber as any
      }
    }
    // ...fallback to reading __reactFiber$ key off the element...
  }
  ```
  Note the consumer already **feature-detects** (`devtools?.getFiberForElement`)
  and falls back gracefully — so adding a field cannot break it.
- The hook's TS shape is declared in **two places** that must stay in sync: the
  inline cast in `preload.ts:143` and the `declare global` in
  `react-fiber.ts:6`. Both get the new optional field.
- Tests touching the hook: `src/preload.test.ts` (constructs/reads the hook) and
  `src/utils.test.ts` (assigns `window.__DIRECT_EDIT_DEVTOOLS__ = { ... }` in
  several places ~lines 966-1090). Adding an **optional** field must not break
  these (they set the fields they need); confirm.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install`                            | exit 0              |
| Typecheck | `bunx tsc --noEmit`                      | exit 0, no errors   |
| Tests     | `bunx vitest run src/preload.test.ts src/utils.test.ts` | all pass |
| Full gate | `bun run test`                           | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/preload.ts` (set `version` on the installed hook; update the inline type)
- `src/utils/react-fiber.ts` (add optional `version` to the `declare global` shape)
- `src/preload.test.ts` (one assertion that `version` is set — optional but
  recommended)

**Out of scope** (do NOT touch):
- `getFiberForElement` behavior, the fallback path, or `wrapHook`/`createHook`.
- Any consumer logic that *acts* on the version — this plan only *publishes* the
  version; no compatibility branching is added yet (there is nothing to branch
  on). Adding behavior would be speculative.
- The `hasHook` field — keep it; `version` complements it.

## Git workflow

- Branch: `advisor/015-preload-hook-version`
- Commit message: `chore: add version field to preload devtools hook`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Define and set the version on the installed hook

In `src/preload.ts`:
- Add a module constant near the top:
  `const DEVTOOLS_HOOK_VERSION = 1` (with a one-line comment: bump when the
  `__DIRECT_EDIT_DEVTOOLS__` shape changes in a breaking way).
- In the inline cast type (line ~143), add `version?: number` to the
  `__DIRECT_EDIT_DEVTOOLS__` shape.
- In the assignment (line ~155), set `version: DEVTOOLS_HOOK_VERSION`:
  ```ts
  globalWindow.__DIRECT_EDIT_DEVTOOLS__ = {
    getFiberForElement,
    hasHook: true,
    version: DEVTOOLS_HOOK_VERSION,
  }
  ```

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Add the field to the consumer's type declaration

In `src/utils/react-fiber.ts`, add `version?: number` to the `declare global`
`Window['__DIRECT_EDIT_DEVTOOLS__']` shape (line ~6). Do **not** add any logic
that reads it — type-only, so future code can reference `devtools.version`
without a TS error.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: (Recommended) Pin it with a test

In `src/preload.test.ts`, after the hook is installed in a test, assert
`window.__DIRECT_EDIT_DEVTOOLS__?.version` is a number (e.g. `=== 1`). Follow
the existing setup/teardown in that file (it deletes
`window.__DIRECT_EDIT_DEVTOOLS__` in setup — see line ~21).

**Verify**: `bunx vitest run src/preload.test.ts` → all pass including the new
assertion.

### Step 4: Confirm existing hook tests still pass

The tests in `src/utils.test.ts` that assign a hand-built
`window.__DIRECT_EDIT_DEVTOOLS__ = { getFiberForElement, hasHook: true }`
(without `version`) must still typecheck and pass, because `version` is
optional.

**Verify**: `bunx vitest run src/utils.test.ts` → all pass;
`bun run test` → full suite passes.

## Test plan

One new assertion in `src/preload.test.ts` confirming the installed hook
exposes `version === 1`. No other tests needed — the field is data, not
behavior. Existing hook-mocking tests in `src/utils.test.ts` serve as the
regression check that the optional field doesn't break consumers.

## Done criteria

- [ ] `src/preload.ts` sets `version: DEVTOOLS_HOOK_VERSION` (=== 1) on the hook
- [ ] Both type declarations (`preload.ts` inline cast and `react-fiber.ts`
      `declare global`) include `version?: number`
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0; `src/preload.test.ts` asserts `version`
- [ ] No behavior change to `getFiberForElement` (`git diff` shows only the
      version field + types + one test assertion)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The two type declarations have drifted apart from the excerpts such that
  adding the field cleanly is non-obvious — report the divergence.
- Any existing test asserts the hook object has *exactly* `{ getFiberForElement,
  hasHook }` (a strict shape check) and the new field breaks it — report it; the
  fix is to relax that assertion, not to drop the version field.

## Maintenance notes

- **The version is a contract**: bump `DEVTOOLS_HOOK_VERSION` only when the hook
  shape changes in a way that an older consumer cannot tolerate. When you do,
  add the consumer-side compatibility check (e.g. `if ((devtools.version ?? 0)
  < N) fall back`) — that branch is intentionally absent now because there is
  nothing to branch on.
- Keep the two type declarations in sync; a future refactor that extracts a
  shared `DevToolsBridge` type into `src/types.ts` would remove the
  duplication (out of scope here).
- A reviewer should confirm the field is published but not yet consumed — no
  speculative version-branching logic snuck in.

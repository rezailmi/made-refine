# Plan 014: Add a `test:fast` script that skips the full build before tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1687d9..HEAD -- package.json vitest.config.ts`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (additive script; the existing `test` gate is unchanged)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `c1687d9`, 2026-06-13

## Why this matters

Every `bun run test` pays for a full `tsup` + Tailwind build first, because
`pretest` is wired to `bun run build`. That build exists deliberately — some
tests verify the built `dist/` is portable (e.g.
`src/package-portability.test.ts`). But for the inner dev loop (run one test
file, iterate) the build is pure latency. This plan adds a `test:fast` script
that runs Vitest directly with no prebuild, so iterating on a single test is
seconds not tens of seconds — **without** weakening the canonical `test` gate
that CI uses.

## Current state

`package.json` scripts (relevant subset):
```json
"build": "tsup",
"pretest": "bun run build",
"test": "vitest run"
```
- `pretest` is an npm/bun lifecycle hook: it runs automatically before `test`.
  So `bun run test` = build, then `vitest run`.
- Some tests depend on `dist/` existing/being current — notably
  `src/package-portability.test.ts` (verifies the published package layout).
  These would **fail or be stale** if run without a build. So `test:fast` must
  not become the CI gate; it is a developer convenience that excludes the
  build-dependent tests, or accepts that they need a prior build.
- CI (`.github/workflows/publish.yml`) calls `bun run build` then
  `bunx vitest run` explicitly (it does not rely on `pretest`), so CI is
  unaffected by anything here.
- Test runner config: `vitest.config.ts` (read it to confirm whether test
  files can be filtered by path and whether there is a project/include glob).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install`                            | exit 0              |
| Fast tests| `bun run test:fast`                      | runs vitest with NO preceding build |
| Full gate | `bun run test`                           | builds then all pass |
| Typecheck | `bunx tsc --noEmit`                      | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `package.json` (add `test:fast`; do NOT change `test` or `pretest`)

**Out of scope** (do NOT touch):
- The existing `test` / `pretest` / `build` scripts — the canonical gate stays
  build-first.
- `.github/workflows/publish.yml` — CI keeps building before tests.
- `vitest.config.ts` — unless a `test:fast` exclude is the chosen approach (see
  Step 2 decision); prefer not to.

## Git workflow

- Branch: `advisor/014-test-fast-script`
- Commit message: `chore: add test:fast script to skip prebuild on inner loop`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the `test:fast` script

In `package.json`, add (note: naming it `test:fast` — NOT `pretest:fast` — means
bun does not run the `pretest` build hook for it, because lifecycle hooks only
fire for the exact `test` name):
```json
"test:fast": "vitest run"
```
This runs Vitest directly. Developers pass a path filter:
`bun run test:fast src/canvas-store.test.ts`.

**Verify**: `bun run test:fast src/canvas-store.test.ts 2>&1 | head -20` →
Vitest runs that file **without** a preceding `tsup`/Tailwind build line in the
output. (If you see the build run, the hook fired — the script name is wrong.)

### Step 2: Decide how to handle build-dependent tests

Run the fast script across the whole suite once to see what breaks without a
build:
`bun run test:fast 2>&1 | tail -30`.
- If `src/package-portability.test.ts` (or similar dist-dependent tests) fail
  because `dist/` is missing/stale, that is expected. Two acceptable handlings:
  - **(Preferred, zero-config)** Document in the script's intent that
    `test:fast` is for iterating on a filtered file and that the full suite
    still needs `bun run test`. Add a one-line note where scripts are
    documented if such a place exists (e.g. `docs/`), otherwise skip.
  - **(Optional)** If you want `bun run test:fast` (no filter) to be green,
    confirm `dist/` exists from a prior build; do NOT add an exclude that hides
    real failures. Do not over-engineer.

**Verify**: `bun run test:fast src/canvas-store.test.ts` passes in seconds; the
canonical `bun run test` still builds and passes the full suite.

### Step 3: Confirm the canonical gate is untouched

**Verify**:
- `bun run test` → still runs the build (you see the `tsup`/Tailwind output)
  then the full suite passes.
- `git diff c1687d9 -- package.json` shows only the added `test:fast` line; the
  `test` and `pretest` entries are byte-identical.

## Test plan

No unit tests — this is a script addition. Verification is behavioral: the new
script skips the build (fast), the old script keeps the build (safe), and a
filtered fast run passes.

## Done criteria

- [ ] `package.json` has a `test:fast` script equal to `vitest run`
- [ ] `bun run test:fast src/canvas-store.test.ts` runs WITHOUT a preceding
      build step in its output
- [ ] `bun run test` is unchanged and still builds then passes the full suite
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `git diff c1687d9 -- package.json` shows only the additive change
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Naming the script `test:fast` still triggers the `pretest` build (bun
  version-specific hook behavior) — report it; the fallback is an explicit
  command `vitest run` documented for manual use, or a differently named script
  like `t` that provably skips the hook.
- Skipping the build makes a *non-dist* test fail (i.e. tests have a hidden
  build dependency beyond `package-portability`) — report which tests.
- `package.json` `test`/`pretest` would need changing to make this work — it
  should not; the whole point is leaving the canonical gate intact.

## Maintenance notes

- If a watch loop is wanted too, `vitest` (no `run`) is the watch mode; a
  `test:watch` script could be added later, same hook-avoidance reasoning.
- A reviewer should confirm CI still builds before testing (it calls `bun run
  build` explicitly, so this change cannot weaken CI).
- If `test:fast` (unfiltered) is expected to be green in the future, the clean
  solution is a Vitest workspace/project split separating dist-portability
  tests from unit tests — out of scope here, note it if the team asks.

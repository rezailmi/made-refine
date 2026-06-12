# Plan 003: Inject `data-direct-edit-source` attributes in development builds only

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d582bd9..HEAD -- babel/index.cjs src/cli.ts docs/cli.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d582bd9`, 2026-06-12

## Why this matters

The babel plugin (`made-refine/babel`) stamps every lowercase JSX element with `data-direct-edit-source="/[project]/<relative path>:<line>:<col>"` so the overlay can map DOM nodes back to source. The plugin has **no environment gating**, and the CLI (`npx made-refine init`) wires it into Vite's `react()` plugin unconditionally (`src/cli.ts:376` and `:424`). Two consequences: (1) Vite's `react()` plugin runs its babel pipeline during `vite build` too — so consumer **production** bundles ship a source-file path and line number on every host element, leaking project structure to anyone who opens DevTools and bloating the production DOM; (2) consumer **test** runs (`NODE_ENV=test` under Jest/Vitest) get the attributes injected into rendered output, polluting their snapshots and DOM assertions with machine-specific paths. The maintainer decided (2026-06-12): inject in **development only**. (The runtime pieces are already gated: the CLI wraps `<DirectEdit />` and the preload script in `process.env.NODE_ENV === 'development'` checks, and the vite plugin's own HTML transforms check `config.command !== 'serve'` — the babel plugin is the one ungated piece.)

## Current state

- `babel/index.cjs` (45 lines, CommonJS, no build step — shipped as `dist/babel.cjs` via tsup) — the whole plugin:

```js
module.exports = function directEditSourcePlugin({ types: t }) {
  return {
    name: 'direct-edit-source',
    visitor: {
      JSXOpeningElement(nodePath, state) {
        ...
        node.attributes.push(
          t.jsxAttribute(t.jsxIdentifier('data-direct-edit-source'), t.stringLiteral(value))
        )
      },
    },
  }
}
```

Note the signature destructures `{ types: t }` from the babel API object — the full API object (which has `.env()`) is the first argument.

- `src/cli.ts:371–381` — when initializing a Vite project, the CLI rewrites the consumer's `vite.config` to `react({ babel: { plugins: ['made-refine/babel'] } })`, with no env condition. Line ~424 has the same string in the fallback/template path.
- `vite/index.ts:133,149` — the made-refine vite plugin's own transforms are gated on `config.command !== 'serve'` returning early. **Do not touch this file.**
- Babel resolves the active env as `BABEL_ENV || NODE_ENV || 'development'`, exposed to plugins as `api.env()`. `vite build` and `next build` set `NODE_ENV=production`.
- There is no existing test for the babel plugin. `@babel/core` is NOT a devDependency — do not add it. The plugin can be unit-tested by calling the exported function with a mock API object.
- Test conventions: vitest, test files in `src/` named `*.test.ts` — see `src/cli-package-manager.test.ts` for a plain-function test exemplar.

## Commands you will need

| Purpose   | Command                                      | Expected on success |
|-----------|----------------------------------------------|---------------------|
| Install   | `bun install`                                | exit 0              |
| Typecheck | `bunx tsc --noEmit`                          | exit 0, no errors   |
| Targeted tests | `bunx vitest run src/babel-plugin.test.ts` | all pass        |
| Full gate | `bun run test` (runs a full build first)     | all pass            |

## Scope

**In scope** (the only files you should modify):
- `babel/index.cjs`
- `src/babel-plugin.test.ts` (create)
- `docs/cli.md` (one-line note that the babel plugin is a no-op when `api.env()` is `production`)

**Out of scope** (do NOT touch):
- `vite/index.ts` — already correctly gated on `serve`.
- `src/cli.ts` and its templates — leaving the plugin in the consumer's config is fine once the plugin no-ops in production; rewriting consumer configs conditionally is brittle and unnecessary.
- `src/preload.ts`, the `<DirectEdit />` gating — already handled by the CLI's `NODE_ENV` wrappers.
- `tsup.config.ts` — the babel entry is already built; no config change needed.

## Git workflow

- Branch: `advisor/003-gate-babel-source-attrs`
- Commit message: `fix: skip data-direct-edit-source injection in production builds`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Gate the plugin to development only

Modify `babel/index.cjs` to accept the full API object and return an empty visitor unless the babel env is `development`:

```js
module.exports = function directEditSourcePlugin(api) {
  const t = api.types
  // Source attributes are a dev-only aid: never ship file paths to production,
  // and never pollute consumers' test snapshots (NODE_ENV=test).
  if (typeof api.env === 'function' && !api.env('development')) {
    return { name: 'direct-edit-source', visitor: {} }
  }
  return {
    name: 'direct-edit-source',
    visitor: {
      // ... existing JSXOpeningElement visitor, unchanged ...
    },
  }
}
```

Notes: Babel resolves env as `BABEL_ENV || NODE_ENV || 'development'`, so a raw babel setup with nothing set still injects (env defaults to `development`). The `typeof api.env === 'function'` guard keeps the plugin working (injecting, preserving current behavior) if a non-babel caller passes a bare `{ types }` object. Keep the existing visitor body byte-for-byte identical apart from the surrounding changes.

**Verify**: `bun run build` → exit 0 and `dist/babel.cjs` regenerated (check with `ls -la dist/babel.cjs`).

### Step 2: Add unit tests with a mock babel API

Create `src/babel-plugin.test.ts`. Import the plugin with `createRequire` (the repo is ESM-typed TS; `babel/index.cjs` is CJS):

```ts
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const directEditSourcePlugin = require('../babel/index.cjs')
```

Tests (mock API: `{ types: <minimal stub>, env: (name) => name === <activeEnv> }`):

1. Active env `development` → returned `visitor.JSXOpeningElement` is a function.
2. Active env `production` → returned object has `visitor` equal to `{}` (no `JSXOpeningElement` key).
3. Active env `test` → `visitor` equal to `{}` (snapshot-pollution case).
4. API object without `env` (legacy `{ types }` only) → `visitor.JSXOpeningElement` is a function (backwards compatible).

For the `types` stub, pass an object with the handful of methods the visitor references (`isJSXIdentifier`, `isJSXAttribute`, `jsxAttribute`, `jsxIdentifier`, `stringLiteral`) as no-op functions — the tests above never invoke the visitor, so stubs are sufficient.

**Verify**: `bunx vitest run src/babel-plugin.test.ts` → 4 tests pass.

### Step 3: Document the behavior

In `docs/cli.md`, in the section describing the Vite setup (`Adds babel: { plugins: ['made-refine/babel'] } ...`, line ~24), append one sentence: the plugin only injects when Babel's env is `development` (the default when `NODE_ENV` is unset), so the attribute never reaches production builds or test snapshots.

**Verify**: `grep -n "production" docs/cli.md` → shows the new sentence.

## Test plan

- Four unit tests in `src/babel-plugin.test.ts` as listed in Step 2 (development active; production and test no-op; legacy API compatible).
- Pattern: plain-function vitest tests like `src/cli-package-manager.test.ts`.
- Verification: `bun run test` → all pass.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0; the 4 new babel-plugin tests pass
- [ ] `grep -n "env(" babel/index.cjs` shows the development-only gate
- [ ] `bun run build` succeeds and regenerates `dist/babel.cjs`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `babel/index.cjs` no longer matches the excerpt (drift — someone may have already gated it).
- `bun run build` fails on the modified CJS file — tsup may be doing more than copying it; report the build error rather than reworking the build config.
- You find evidence (a test, a doc, a consumer template) that the production attribute is **intentional** — e.g. a "production annotation mode". None was found at planning time, but if it exists this becomes a maintainer decision.

## Maintenance notes

- If the maintainer later wants source mapping in *preview* deployments or test runs, the gate should become opt-in via an explicit plugin option (e.g. `{ envs: ['development', 'test'] }`) rather than loosening the env check.
- Reviewer should scrutinize: the gate is `!api.env('development')` (inject ONLY in development — maintainer decision 2026-06-12), not a production-only skip; and that the legacy no-`env` fallback still injects.
- Related but separate: the vite plugin path (`vite/index.ts`) injects the same attribute and is already gated on `serve`; if a third injection path is ever added, gate it the same way.

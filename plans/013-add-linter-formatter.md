# Plan 013: Add a linter/formatter with a non-blocking baseline and a CI check

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1687d9..HEAD -- package.json .github/workflows/publish.yml`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (additive tooling; the gate is introduced non-blocking so a
  large existing-warning backlog doesn't break CI on day one)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `c1687d9`, 2026-06-13

## Why this matters

The repo has **no linter or formatter** — CI (`.github/workflows/publish.yml`)
runs only `tsc --noEmit` + `vitest`. There is no automated enforcement of code
style, no catch for common JS/TS footguns (unused vars, floating promises,
`==` vs `===`), and the codebase already relies on inline
`// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments
(e.g. `src/utils/react-fiber.ts:17`) that reference an ESLint config **that
does not exist**. This plan adds a linter+formatter, wires a `lint` script,
adds a CI step, and — critically — introduces it **non-blocking** so the
inevitable backlog of existing issues doesn't wedge every PR. New code gets
checked; the existing backlog is tracked, not force-fixed.

## Current state

- `package.json` scripts (no `lint`, no `format`):
  ```json
  "build": "tsup",
  "pretest": "bun run build",
  "test": "vitest run",
  "dev": "...", "dev:app": "vite", "dev:all": "..."
  ```
  `devDependencies` include `typescript`, `vite`, `vitest`, `tsup`, `esbuild` —
  **no eslint, no prettier, no biome**.
- No `.eslintrc*`, `eslint.config.*`, `.prettierrc*`, or `biome.json` at the
  repo root (confirmed absent).
- Inline lint-disable comments already exist in source (e.g.
  `src/utils/react-fiber.ts:17` `// eslint-disable-next-line
  @typescript-eslint/no-explicit-any`) — they currently do nothing because no
  ESLint runs. Choosing **ESLint** makes these comments live again; choosing
  Biome would orphan them. **Recommendation: ESLint flat config + Prettier**,
  because the codebase already speaks ESLint's disable-comment dialect.
  (Biome is faster and single-tool, but would require rewriting existing
  disable comments — more churn, and it is an explicitly different toolchain.)
- Package manager is **bun** (`CLAUDE.md`: "use `bun run` for scripts").
- CI: `.github/workflows/publish.yml` job `ci` (lines ~47-68) runs
  `bun install --frozen-lockfile`, `bun run build`, `bunx tsc --noEmit`,
  `bunx vitest run` on push and PR to `main`.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install`                            | exit 0              |
| Add dep   | `bun add -d <pkg>`                       | updates package.json + bun.lock |
| Lint      | `bun run lint`                           | exit 0 (see Step 4 on baseline) |
| Format check | `bun run format:check`                | exit 0              |
| Typecheck | `bunx tsc --noEmit`                      | exit 0, no errors   |
| Full gate | `bun run test`                           | all pass            |

> NOTE: This plan is one of the few where adding dependencies and editing
> `package.json` is explicitly **in scope** (it is the deliverable). `bun add`
> writes `bun.lock` — that is expected and required.

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (add devDeps + `lint`, `lint:fix`, `format`, `format:check` scripts)
- `bun.lock` (updated by `bun add`)
- `eslint.config.mjs` (create — flat config)
- `.prettierrc.json` (create) and `.prettierignore` (create)
- `.eslintignore` is not used in flat config — put ignores in `eslint.config.mjs`
- `.github/workflows/publish.yml` (add a non-blocking lint step to the `ci` job)

**Out of scope** (do NOT touch):
- **Do NOT auto-fix or reformat the existing codebase in this PR.** Running
  `eslint --fix` / `prettier --write` across `src/` would produce a massive,
  unreviewable diff and risk behavior changes. The baseline is captured, not
  cleared. (A separate future PR can format the tree.)
- Removing existing `// eslint-disable` comments.
- Changing `tsconfig.json` or test config.

## Git workflow

- Branch: `advisor/013-add-linter`
- Commit message: `chore: add eslint + prettier with non-blocking ci baseline`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add dev dependencies

```
bun add -d eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-config-prettier prettier
```
- `typescript-eslint` provides the flat-config helper + TS rules.
- `eslint-plugin-react-hooks` — this is a React hooks codebase; rules-of-hooks
  is high value.
- `eslint-config-prettier` disables formatting rules that conflict with
  Prettier.

**Verify**: `bun install` → exit 0; `package.json` `devDependencies` now lists
the six packages.

### Step 2: Create the ESLint flat config

Create `eslint.config.mjs`:
```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'dev/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  prettier,
)
```
Adjust the `ignores` to match the repo (build output is `dist/`, the demo
playground is `dev/`). Do not add custom strict rules beyond the recommended
sets — the goal is a working baseline, not a style crusade.

**Verify**: `bunx eslint . 2>&1 | tail -5` runs (it WILL report existing
problems — that is expected and handled in Step 4). Confirm it executes without
a *config* error (no "couldn't find config" / parse error).

### Step 3: Create Prettier config and scripts

Create `.prettierrc.json` (match the codebase's observed style — inspect a few
source files first; the code uses single quotes and no semicolons in many
places, so confirm):
```json
{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "es5" }
```
Create `.prettierignore`:
```
dist
node_modules
bun.lock
*.d.ts
```
Add scripts to `package.json`:
```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

**Verify**: `bun run format:check 2>&1 | tail -5` runs (will list unformatted
files — expected; do not fix them here).

### Step 4: Capture the baseline non-blocking, wire CI

The existing codebase will have many lint/format findings. Do **not** fix them.
Instead make the gate non-blocking so it informs without breaking:
- In `.github/workflows/publish.yml`, in the `ci` job, add a step AFTER
  typecheck:
  ```yaml
        - name: Lint (non-blocking baseline)
          run: bun run lint || true
  ```
  Using `|| true` reports lint output in CI logs without failing the build on
  the pre-existing backlog. (A follow-up PR flips it to blocking after the
  backlog is cleared — see Maintenance notes.)
- Do not add a format check to CI yet (it would be noisy against an unformatted
  tree); the `format:check` script exists for local/opt-in use.

**Verify**:
- `bunx tsc --noEmit` → exit 0 (config files don't affect typecheck).
- `bun run test` → all pass (tooling addition doesn't touch runtime).
- `grep -n "react-fiber" eslint.config.mjs` is not expected; instead confirm
  the existing disable comment is now meaningful:
  `bunx eslint src/utils/react-fiber.ts 2>&1` runs without crashing.

## Test plan

No unit tests (this is tooling). Verification is that the scripts run, CI parses
the new step, and the existing test suite + typecheck are unaffected. The
"test" of the linter is that `bun run lint` executes and produces a finding
report; capture the count of findings in the PR description as the baseline.

## Done criteria

- [ ] `bun run lint` executes (non-zero exit from existing findings is
      acceptable; a config/parse error is NOT)
- [ ] `bun run format:check` executes
- [ ] `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore` exist
- [ ] `package.json` has `lint`, `lint:fix`, `format`, `format:check` scripts
      and the six new devDependencies
- [ ] `.github/workflows/publish.yml` `ci` job has the non-blocking lint step
- [ ] `bunx tsc --noEmit` exits 0 and `bun run test` passes (unchanged)
- [ ] `git diff --stat` shows **no changes under `src/`** (no mass reformat)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `typescript-eslint` flat-config setup produces a config error that isn't
  resolved within two attempts (version-compat issues are common — report the
  versions installed).
- Any temptation to run `--fix`/`--write` across `src/` to "make it pass" — that
  is explicitly out of scope; the gate is non-blocking precisely to avoid it.
- Adding the deps changes `bun install` behavior for existing scripts (e.g. a
  peer-dependency conflict with the installed React/TypeScript versions).
- The CI YAML fails to parse (validate indentation against the existing steps).

## Maintenance notes

- **Follow-up PR (deferred)**: once someone runs `bun run lint:fix` +
  `bun run format` across the tree (a large but mechanical diff, reviewed on its
  own), flip the CI step from `bun run lint || true` to `bun run lint` (blocking)
  and add `bun run format:check` to CI. Track this as a separate backlog item.
- The existing inline `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
  comments (react-fiber.ts and elsewhere) become live with this config — a
  reviewer should confirm they suppress the rule they name and aren't masking
  unrelated issues.
- If the team later prefers a single fast tool, Biome is the alternative — but
  migrating means rewriting the disable comments; weigh that before switching.
- A reviewer should scrutinize: that no `src/` file was reformatted (the diff
  must be tooling + config + CI only).

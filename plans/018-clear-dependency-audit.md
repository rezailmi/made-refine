# Plan 018: Clear the standalone dependency audit baseline

> **Executor instructions**: Run the live audit first and use it as truth. Keep
> dependency edits as small as practical. If a high/critical advisory cannot be
> cleared without a breaking migration, stop and report the package and required
> version instead of forcing it.
>
> **Drift check (run first)**: `git diff --stat 14d4087..HEAD -- package.json bun.lock .github/workflows/publish.yml`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security / dependencies
- **Planned at**: commit `14d4087`, 2026-06-22

## Why this matters

`bun audit` currently reports critical/high advisories in direct and transitive
dev/build dependencies (`vitest`, `shell-quote`, `vite`, `undici`, `rollup`,
`picomatch`). This package is published to npm, so release gates should not sit
on a red high-severity audit baseline.

## Scope

**In scope**: `package.json`, `bun.lock`, and only if needed
`.github/workflows/publish.yml`.

**Out of scope**: runtime API changes, source refactors, package version bumps.

## Steps

1. Run `bun audit` and record the live critical/high set.
2. Bump direct dependencies first: `vitest`, `vite`, `esbuild`,
   `tailwind-merge`/`lucide-react` if lockfile dedupe helps, and any direct
   package that owns a high/critical path.
3. Add narrow `overrides` only for transitive advisories that parent bumps cannot
   clear (`shell-quote`, `rollup`, `undici`, `picomatch`, etc.).
4. Verify with `bun install`, `bun audit --audit-level high`, `bun run build`,
   `bunx tsc --noEmit`, and `bun run test`.

## Done criteria

- [ ] `bun audit --audit-level high` exits 0
- [ ] `bun run build` exits 0
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0

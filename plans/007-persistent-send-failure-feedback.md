# Plan 007: Make send-to-agent failures persistent, explained, and per-item visible

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d582bd9..HEAD -- src/use-agent-comms.ts src/panel/panel-footer.tsx src/toolbar.tsx src/toolbar/edits-popover.tsx src/provider.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches provider context surface and three UI components)
- **Depends on**: none (coordinates visually with plan 006's future stale states, but does not wait for it)
- **Category**: bug / UX (send-pipeline visibility)
- **Planned at**: commit `d582bd9`, 2026-06-12

## Why this matters

Send failures are currently communicated by a **2-second flash**: the panel footer's send button shows a red X (`panel-footer.tsx:107–112`) and the toolbar's apply-all does the equivalent (`toolbar.tsx:174`), then both reset to idle. Failed items correctly stay in the session for retry — but nothing *tells* the user why a send failed, the flash is easy to miss entirely, and after a partial batch failure the edits popover gives no indication which items failed (they just silently remain in the list). Maintainer decision (2026-06-12, full scope): failure state must **persist until the next attempt**, carry a **reason**, and the popover must mark **which items** failed.

Important context: an earlier audit claim that failures are invisible/lose work was wrong — the flash exists and edits are retained. This plan upgrades existing feedback; it does not bolt feedback onto nothing. Match and extend the existing status patterns rather than inventing a parallel system.

## Current state

- `src/use-agent-comms.ts` — owns send logic and `agentAvailable` state:
  - `const [agentAvailable, setAgentAvailable] = React.useState(false)` (line ~79) with `updateAgentAvailability(available)` (line ~88) returning the boolean it was given.
  - `sendSessionEditToAgent` (lines ~145–203): on success `removeSessionEdit(sessionEdit.element)`; on `result.ok === false` or thrown error, returns false via `updateAgentAvailability`. Two failure modes are currently conflated: **thrown/network** (agent unreachable) and **`result.ok === false`** (broker reachable but rejected).
  - `sendSessionCommentToAgent` (lines ~205–223): same shape; success deletes the comment.
  - `sendAllSessionItemsToAgent` (lines ~297–352): iterates items sequentially, tracks only an aggregate `allSucceeded` boolean. Per-item identity is available in the loop: edits by `item.edit.element` (HTMLElement), comments by `item.comment.id` (string).
- `src/panel/panel-footer.tsx` — single-send button: `sendStatus: 'idle' | 'sending' | 'sent' | 'offline'` (line 34); `handleSendToAgent` (lines 50–59) sets `'offline'` on failure then `setTimeout(... 'idle', 2000)`. Renders red `X` with `aria-label="Send failed"` (lines 103–112) inside a `Tip` whose label is currently the static "Apply changes via agent".
- `src/toolbar.tsx` — apply-all button: `applyStatus` with the same vocabulary; `scheduleApplyReset` (lines ~150–161) resets to idle after 2000ms for BOTH 'sent' and 'offline'; `handleApplyAll` (lines ~163–176).
- `src/toolbar/edits-popover.tsx` (318 lines) — lists session items; per-item rendering starts at line ~214 (`const isEdit = item.type === 'edit'`), item key at line ~243 (`item.type === 'comment' ? item.comment.id : `edit-${i}``), per-item remove actions at lines ~272–276. A `Badge` component is already imported from `../ui/badge` (line 7).
- `src/provider.tsx` — context exposes `agentAvailable` (line 100 of the context type, value wired at ~510, 562). New state must flow the same way.
- Public-surface caution (`AGENTS.md`): `DirectEditToolbarInner` and other components are publicly exported; **add only optional props** so direct importers don't break.
- Conventions: state lives in hooks receiving refs/stable callbacks (see `docs/module-structure.md`); UI uses the existing `Tip`/`Tooltip` + `Badge` primitives; tests for provider-level flows live in `src/provider.test.tsx`, mcp-client mocking exemplar in `src/mcp-client.test.ts`.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install`                            | exit 0              |
| Typecheck | `bunx tsc --noEmit`                      | exit 0, no errors   |
| Targeted tests | `bunx vitest run src/provider.test.tsx src/toolbar.test.tsx` | all pass |
| Full gate | `bun run test` (runs a full build first) | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/use-agent-comms.ts`
- `src/panel/panel-footer.tsx`
- `src/toolbar.tsx`
- `src/toolbar/edits-popover.tsx`
- `src/provider.tsx` (thread the new state through context — additive only)
- `src/types.ts` (if the context type lives here — additive only)
- `src/provider.test.tsx`, `src/toolbar.test.tsx` (tests)

**Out of scope** (do NOT touch):
- `src/mcp-client.ts` — failure *classification* happens in use-agent-comms from what the client already returns/throws; do not change the client contract.
- Retry-with-backoff, queueing, offline persistence — explicitly deferred.
- Comment-overlay send paths beyond what flows through `sendSessionCommentToAgent`.
- Removing the existing `agentAvailable` mechanism — the new state complements it.

## Git workflow

- Branch: `advisor/007-send-failure-feedback`
- Commit message: `feat: persistent send-failure feedback with reason and per-item indicators`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record failure details in `useAgentComms`

Add state alongside `agentAvailable`:

```ts
  export type SendFailure = {
    reason: 'unreachable' | 'rejected'
    failedEditElements: HTMLElement[]
    failedCommentIds: string[]
    at: number
  }
  const [lastSendFailure, setLastSendFailure] = React.useState<SendFailure | null>(null)
```

Wire it:
- In `sendSessionEditToAgent` / `sendSessionCommentToAgent`: classify `catch` → `'unreachable'`, `result.ok === false` → `'rejected'`. For single sends, set `lastSendFailure` with the one failed identity; clear it (`null`) at the START of every new send attempt and on success.
- In `sendAllSessionItemsToAgent`: collect failed identities in the existing loop (edits: `item.edit.element`; comments: `item.comment.id`; the context-only block failure counts as reason-only). After the loop, set one aggregated `lastSendFailure` (or `null` if all succeeded). Prefer `'unreachable'` as the aggregate reason if ANY item threw; else `'rejected'`.
- Return `lastSendFailure` (and a `clearSendFailure` callback) from the hook; expose both through the provider context the same way `agentAvailable` flows (provider.tsx ~100/510/562). Keep the existing boolean return values of all send functions UNCHANGED (public behavior contract).

**Verify**: `bunx tsc --noEmit` → exit 0; `bunx vitest run src/provider.test.tsx` → existing tests pass.

### Step 2: Persistent error on the footer send button

In `panel-footer.tsx`: on failure, keep `'offline'` until the user acts — remove the 2s auto-reset for the failure branch only (keep it for `'sent'`). Reset to `'idle'` when: a new send starts, or the selected element changes (existing prop flow indicates this — find the effect that resets state on selection change; if none exists, reset on `canTriggerSend` flipping). Change the `Tip` label to be status-aware: when failed, show `reason === 'unreachable' ? 'Agent unreachable — click to retry' : 'Agent rejected the edit — click to retry'` (accept the new optional `sendFailureReason` prop; keep the static label otherwise). The button stays enabled in the failed state (clicking retries — it already does).

**Verify**: `bunx vitest run src/provider.test.tsx` → pass.

### Step 3: Persistent error on the toolbar apply-all button

In `toolbar.tsx`: same split — `scheduleApplyReset` only auto-resets `'sent'`; `'offline'` persists until the next `handleApplyAll` or until `totalItemCount` changes. Status-aware tooltip with the same reason wording via a new optional prop.

**Verify**: `bunx vitest run src/toolbar.test.tsx` → pass.

### Step 4: Per-item failure badges in the edits popover

In `edits-popover.tsx`: accept a new optional prop `sendFailure?: { failedEditElements: HTMLElement[]; failedCommentIds: string[] } | null`. In the item renderer (~line 214+), compute `const failed = isEdit ? sendFailure?.failedEditElements.includes(item.edit.element) : sendFailure?.failedCommentIds.includes(item.comment.id)`. When `failed`, render the existing `Badge` component with text `Failed` (destructive/red styling consistent with `ui/badge`'s variants — check its variant API and use the closest to destructive) next to the item's existing badges. Clear naturally: the prop comes from `lastSendFailure`, which Step 1 clears on the next attempt; successful items are removed from the session anyway.

Thread the prop: provider context → toolbar → `EditsPopover` (all additive optional props).

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 5: Tests

- In `src/provider.test.tsx` (mock `./mcp-client` with `vi.mock`, following any existing mocking in `src/mcp-client.test.ts` / provider tests):
  1. Failed single send (mock `postEditToAgent` rejecting) → `lastSendFailure.reason === 'unreachable'`, edit still in session.
  2. Failed single send (mock resolving `{ ok: false }`) → reason `'rejected'`.
  3. Batch of 2 edits, first succeeds second fails → `failedEditElements` contains exactly the second element; first removed from session.
  4. New send attempt clears the previous failure state.
- In `src/toolbar.test.tsx`: failed apply-all keeps the error state past 2s (use fake timers, advance 3000ms, assert still offline); succeeded apply-all resets after 2s (existing behavior, lock it in).

**Verify**: `bunx vitest run src/provider.test.tsx src/toolbar.test.tsx` → all pass including ≥6 new tests.

## Test plan

Covered in Step 5 — failure classification (both reasons), per-item partial-batch attribution, clear-on-retry, persistence past the old 2s window, and the preserved auto-reset for success. Pattern: existing provider tests + `vi.mock` of mcp-client; fake timers per existing toolbar tests if present (check `src/toolbar.test.tsx` for `vi.useFakeTimers` precedent and follow it).

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0; the 6+ new tests pass
- [ ] Failure state persists: no `setTimeout(... 'idle', 2000)` on the failure branch in `panel-footer.tsx` or `toolbar.tsx` (grep both for the reset and confirm it's success-only)
- [ ] `edits-popover.tsx` renders a `Failed` badge for failed items (new optional prop, no required-prop changes — `git diff` shows only additive type changes)
- [ ] All send functions still return the same `Promise<boolean>` signatures
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match (drift) — especially if `sendStatus`/`applyStatus` vocabularies changed.
- Threading the new state requires changing a REQUIRED prop on a publicly exported component (`src/index.ts` exports) — additive-only is a hard constraint; report the conflict.
- `sendAllSessionItemsToAgent`'s loop structure changed such that per-item identity is no longer available at the failure site.
- Mocking `./mcp-client` inside provider tests proves unworkable after two attempts (e.g. module resolution issues with the built dist) — report the obstacle and which tests you could not write.

## Maintenance notes

- Plan 006 (session-lifecycle design) will introduce a *stale* item state in the same popover — the `Failed` badge styling and placement chosen here should leave room for a sibling `Stale` badge; note your placement choice in the PR description.
- If retry-with-backoff is ever added, `lastSendFailure.at` is the timestamp hook for it.
- Reviewer should scrutinize: failure state clearing on selection change (footer) — over-eager clearing would reintroduce the miss-the-flash problem; under-clearing leaves stale errors on unrelated elements.

# Plan 017: Wire the panel footer's send/export path in the provider app (or decide to drop it)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1687d9..HEAD -- src/panel.tsx src/provider.tsx`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW–MED (touches the provider panel render path and its tests;
  additive prop wiring)
- **Depends on**: none (relates to plan 007's footer error states, which this
  makes reachable in the provider app)
- **Category**: bug (dead UI path)
- **Planned at**: commit `c1687d9`, 2026-06-13

## Why this matters

`DirectEditPanelInner` renders a footer with **copy/export** and **send-to-agent**
buttons (and, after plan 007, the persistent send-failure states) — but only
when it receives `onExportEdits` and/or `onSendToAgent` props. The provider path
(`DirectEditPanelContent` → `DirectEditPanelInner` at `src/panel.tsx:795`)
**never passes them**, so the footer condition
`{(onExportEdits || (showSendButton && onSendToAgent)) && (...)}` (`panel.tsx:333`)
is always false: the footer — including 007's failure feedback — is **dead code
in the real app**. Only the direct consumer `src/demo.tsx:240` exercises the
footer. The live send surface in the provider app is the toolbar, not the panel
footer. The backlog asks for a decision: **wire it up** (restore the footer and
007's states in the provider) or **intentionally remove** the footer from the
provider path. This plan implements the **wire-it-up** option (lower-risk,
additive, recovers shipped 007 work) and documents the alternative.

## Current state

- `src/panel.tsx:146-188` — `DirectEditPanelInner` props include the optional
  footer hooks:
  ```ts
  onExportEdits?: () => Promise<boolean>     // line 131
  onSendToAgent?: () => Promise<boolean>     // line 132
  showSendButton?: boolean                   // line 134 (defaults true, line 178)
  ```
- `src/panel.tsx:333` — the footer only renders when a hook is present:
  ```tsx
  {(onExportEdits || (showSendButton && onSendToAgent)) && (
    <PanelFooter onExportEdits={onExportEdits} onSendToAgent={onSendToAgent} showSendButton={showSendButton} ... />
  )}
  ```
- `src/panel.tsx:795-840` — `DirectEditPanelContent` (the PROVIDER path) renders
  `DirectEditPanelInner` with many props but **omits** `onSendToAgent`,
  `onExportEdits`, and any failure props. That is the bug.
- `DirectEditPanelContent` already pulls the needed values from context
  (`src/panel.tsx:355-375`):
  - From `useDirectEditState()`: `agentAvailable`, `lastSendFailure` (line 361).
  - From `useDirectEditActions()`: `sendEditToAgent`, `exportEdits`,
    `sendAllSessionItemsToAgent`, `sendCommentToAgent`, `replaceSelectionColor`
    (lines 369-373). The comment send is already wired elsewhere
    (`onSendToAgent={agentAvailable ? sendCommentToAgent : undefined}` at line
    560 for the comment composer) — proving the pattern.
- `src/provider.tsx` exposes the actions this needs (confirmed):
  - `sendEditToAgent: () => Promise<boolean>` (line 79)
  - `exportEdits: () => Promise<boolean>` (line 60)
  - `agentAvailable`, `lastSendFailure` (line 513)
- The single-element send action for the footer is `sendEditToAgent` (sends the
  currently-selected element's edit). `exportEdits` is the copy/export action.
- Tests: `src/panel.test.tsx:92` renders `DirectEditPanelInner` with
  `onSendToAgent={vi.fn().mockResolvedValue(true)}` — i.e. the footer is tested
  at the `Inner` level. The provider-level wiring is what's untested.
- Public-surface caution (`AGENTS.md`): `DirectEditPanelInner` is exported;
  do not change required props. This plan only adds *call-site* props in the
  provider — no signature change.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install`                            | exit 0              |
| Typecheck | `bunx tsc --noEmit`                      | exit 0, no errors   |
| Tests     | `bunx vitest run src/panel.test.tsx src/provider.test.tsx` | all pass |
| Full gate | `bun run test`                           | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/panel.tsx` (pass the footer props at the `DirectEditPanelContent` →
  `DirectEditPanelInner` call site, line ~795)
- `src/panel.test.tsx` or `src/provider.test.tsx` (a test asserting the footer
  renders + send works in the provider path)

**Out of scope** (do NOT touch):
- `DirectEditPanelInner`'s prop signature or the footer condition (`panel.tsx:333`)
  — they are correct; the bug is the omitted call-site props.
- `src/provider.tsx` action definitions — `sendEditToAgent`/`exportEdits` exist;
  just consume them.
- The toolbar send path — it is the primary live surface and stays as-is.
- `src/demo.tsx` — its direct usage already works.
- Plan 007's failure-state internals — this plan only makes them *reachable* by
  feeding the footer; do not re-implement them.

## Git workflow

- Branch: `advisor/017-wire-panel-footer`
- Commit message: `fix: wire panel footer send/export in provider path so footer (and 007 states) render`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Pass the footer props at the provider call site

In `src/panel.tsx`, in `DirectEditPanelContent`'s render of
`DirectEditPanelInner` (line ~795-840), add:
```tsx
  onExportEdits={exportEdits}
  onSendToAgent={agentAvailable ? sendEditToAgent : undefined}
```
- `exportEdits` and `sendEditToAgent` come from `useDirectEditActions()`. As of
  `c1687d9` the `DirectEditPanelContent` destructure (lines ~363-375) pulls
  `sendCommentToAgent` but **not** `exportEdits` or `sendEditToAgent` — you must
  add both to that `useDirectEditActions()` destructure. They are already part
  of the actions context value (`provider.tsx:60` `exportEdits`,
  `provider.tsx:79` `sendEditToAgent`), so this is an additive read — no new
  context wiring.
- Mirror the existing comment pattern at line 560
  (`agentAvailable ? sendCommentToAgent : undefined`): gate `onSendToAgent` on
  `agentAvailable` so the send button only appears when the agent is reachable.
- If plan 007's footer props exist on `DirectEditPanelInner` (e.g.
  `sendFailureReason` / a failure object) — check the `DirectEditPanelInnerProps`
  interface (lines 66-145) for any 007-added optional prop — pass
  `lastSendFailure` through the matching prop too, so the persistent failure
  state shows. If no such prop exists on `Inner`, do not invent one; just wiring
  `onSendToAgent`/`onExportEdits` is enough to make the footer render.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Manually confirm the footer now renders in the provider app

Run `bun run dev:app`, open the served URL, enter edit mode (Cmd/Ctrl + `.`),
select an element. The panel footer (copy/export + send button) must now be
visible — previously it was absent in this app.

**Verify**: footer is visible with the element selected (screenshot or describe).

### Step 3: Add a regression test for the provider footer wiring

In `src/provider.test.tsx` (or `src/panel.test.tsx` if it can render the full
provider panel), add a test that:
- Renders the provider + panel, enters edit mode, selects an element.
- Asserts the footer send/export button is in the document (query by the
  button's accessible name / `aria-label` — read `PanelFooter` for the exact
  label, e.g. the send button's `aria-label`).
- Optionally: mock the agent send and assert clicking the footer send button
  invokes it.
Follow the rendering/queries already used in `src/provider.test.tsx` (it renders
the provider, toggles edit mode via `KeyboardEvent`, and queries the DOM).

**Verify**: `bunx vitest run src/provider.test.tsx` → all pass including the new
test.

### Step 4: Full gate

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run test` → all pass.

## Test plan

- New test: in the provider path, with edit mode active and an element selected,
  the panel footer renders and its send button calls the send action. This is
  the missing coverage that let the dead path ship. Pattern: existing
  `src/provider.test.tsx` render + edit-mode-toggle + DOM query helpers.
- Existing `src/panel.test.tsx` footer tests (at the `Inner` level) remain the
  unit coverage for the footer's internal behavior.

## Done criteria

- [ ] `DirectEditPanelContent` passes `onSendToAgent` (agent-gated) and
      `onExportEdits` to `DirectEditPanelInner` (`src/panel.tsx` ~line 795)
- [ ] Footer renders in the provider app with an element selected (verified in
      dev app, Step 2)
- [ ] A provider-level test asserts the footer send/export button is present
- [ ] `DirectEditPanelInner`'s prop signature is unchanged (`git diff` shows no
      change to lines ~66-145 interface beyond what 007 already shipped)
- [ ] `bunx tsc --noEmit` exits 0; `bun run test` passes
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The maintainer's intent is actually to REMOVE the footer from the provider
  path (the opposite decision). If so, this plan's approach is wrong — report
  and let them choose; the removal variant would instead pass
  `showSendButton={false}` AND not pass `onExportEdits`, plus delete the now-dead
  footer-only props from the provider path. Do not implement removal under this
  plan without confirmation.
- `sendEditToAgent`/`exportEdits` are not exposed by `useDirectEditActions()`
  in the live code (drift from `provider.tsx:60,79`).
- Wiring the footer surfaces a duplicate/competing send affordance that
  conflicts with the toolbar in a confusing way (e.g. two "apply all" buttons) —
  report the UX collision rather than shipping it.
- The 007 failure-state prop on `DirectEditPanelInner` has an unexpected shape
  that can't be fed from `lastSendFailure` — wire only `onSendToAgent`/
  `onExportEdits` and report the 007-prop gap.

## Maintenance notes

- **The decision recorded here is "wire it up."** The alternative — intentionally
  removing the footer from the provider path because the toolbar is the live
  send surface — is viable and lower-surface; if the team prefers a single send
  affordance, do that instead and delete the footer-only code paths. Capture
  whichever was chosen in the PR description.
- This makes plan 007's footer failure states (`sendFailureReason`, persistent
  offline) reachable in the provider app for the first time — a reviewer should
  verify those states actually appear on a failed send, not just that the button
  renders.
- If both the toolbar and the footer can send, ensure their status states don't
  diverge confusingly (e.g. footer shows "sent" while toolbar shows "offline").

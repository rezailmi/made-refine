# Shadow DOM + Tailwind v4

Tailwind v4 uses `@property` to register initial values for `--tw-*` CSS variables. `@property` is document-scoped and **does not apply inside Shadow DOM**. On modern browsers, the `@supports` fallback block (which sets the same variables unconditionally) is skipped because `@property` is supported — but `@property` doesn't scope to Shadow DOM. This leaves all `--tw-*` variables uninitialized inside the shadow tree.

## What breaks without the fix

These Tailwind classes silently fail (no visible error, just no effect):
- `border`, `border-t`, `border-b` — no `--tw-border-style`
- `-translate-y-1/2`, `-translate-x-1/2` — no `--tw-translate-x/y`
- `shadow-*` — no `--tw-shadow`
- `ring-*` — no `--tw-ring-shadow`

## Our approach

All `--tw-*` variable initializations are copied from Tailwind's `@supports` fallback block into `@layer base` in `src/styles.css`. This makes them apply unconditionally inside the Shadow DOM.

**How to re-sync after a Tailwind upgrade:**
1. Run `bun run build`
2. Inspect `dist/styles.css` for the `@layer properties { @supports ... { * { ... } } }` block
3. Copy all `--tw-*` declarations into the `@layer base` rule in `src/styles.css`

## No conflicts with host app

Shadow DOM prevents style leakage in both directions. If the host app also uses Tailwind, its classes won't affect our Shadow DOM and ours won't affect the host. The only shared surface is `@property` (document-scoped), but we don't rely on it.

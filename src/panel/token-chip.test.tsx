import * as React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TokenChip } from './token-chip'

afterEach(cleanup)

describe('TokenChip', () => {
  it('renders the label text', () => {
    const { container } = render(<TokenChip label="--color-primary" />)
    expect(container.textContent).toContain('--color-primary')
  })

  it('renders a swatch when swatchHex is set, and none when omitted', () => {
    const withSwatch = render(<TokenChip label="--color-primary" swatchHex="3B82F6" />)
    expect(withSwatch.container.querySelector('span[class*="size-3.5"]')).not.toBeNull()
    cleanup()

    const withoutSwatch = render(<TokenChip label="--color-primary" />)
    expect(withoutSwatch.container.querySelector('span[class*="size-3.5"]')).toBeNull()
  })

  it('does not render the popover body at rest (closed)', () => {
    // The popover body only mounts when the chip is open. Interactive open is
    // validated manually in the dev app — base-ui's pointer-driven popover does
    // not open under jsdom's synthetic events (the repo mocks it elsewhere).
    render(
      <TokenChip label="--color-primary">
        <div>POPOVER_BODY_CONTENT</div>
      </TokenChip>,
    )
    expect(document.body.textContent).not.toContain('POPOVER_BODY_CONTENT')
  })

  it('renders the trigger as a button', () => {
    const { container } = render(<TokenChip label="text-base" />)
    const button = container.querySelector('button')
    expect(button).not.toBeNull()
    expect(button?.textContent).toContain('text-base')
  })
})

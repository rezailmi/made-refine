import * as React from 'react'
import { cleanup, render, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorPickerPopover, TokenPalette } from './color-picker'
import { invalidateColorTokenIndex } from '../utils/design-tokens'
import type { ColorValue } from '../types'

// Render the base-ui popover parts inline so the (normally portalled, dismiss-gated)
// popup content is present in the tree for assertions.
vi.mock('@base-ui/react/popover', () => ({
  Popover: {
    Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Trigger: React.forwardRef<
      HTMLButtonElement,
      { render?: React.ReactElement; children?: React.ReactNode; className?: string }
    >(({ children }, ref) => (
      <button ref={ref} type="button">
        {children}
      </button>
    )),
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Positioner: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Popup: React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
      ({ children }, ref) => <div ref={ref}>{children}</div>
    ),
  },
}))

let injectedStyle: HTMLStyleElement | null = null

function injectThemeStyle(css: string) {
  const el = document.createElement('style')
  el.textContent = css
  document.head.appendChild(el)
  injectedStyle = el
  invalidateColorTokenIndex()
}

afterEach(() => {
  cleanup()
  injectedStyle?.remove()
  injectedStyle = null
  invalidateColorTokenIndex()
})

const black: ColorValue = { hex: '000000', alpha: 100, raw: '#000000' }

function findRow(container: HTMLElement, label: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label)
  )
  if (!btn) throw new Error(`No token row found for ${label}`)
  return btn as HTMLButtonElement
}

describe('TokenPalette', () => {
  it('renders a row per color token and reports the pick', () => {
    injectThemeStyle(':root{--color-primary:#3B82F6}')
    const onPick = vi.fn()
    const { container } = render(<TokenPalette onPick={onPick} />)
    expect(container.textContent).toContain('--color-primary')
    fireEvent.click(findRow(container, '--color-primary'))
    expect(onPick).toHaveBeenCalledWith('--color-primary', '3B82F6')
  })

  it('renders nothing when there are no color tokens', () => {
    invalidateColorTokenIndex()
    const { container } = render(<TokenPalette onPick={vi.fn()} />)
    expect(container.textContent).toBe('')
  })
})

describe('ColorPickerPopover token palette', () => {
  it('binds the color to var(--token) when a palette row is clicked', () => {
    injectThemeStyle(':root{--color-primary:#3B82F6}')
    const onChange = vi.fn()
    const { container } = render(
      <ColorPickerPopover value={black} onChange={onChange}>
        <div data-testid="swatch" />
      </ColorPickerPopover>
    )
    expect(container.textContent).toContain('--color-primary')
    fireEvent.click(findRow(container, '--color-primary'))
    expect(onChange).toHaveBeenCalledWith({
      token: '--color-primary',
      raw: 'var(--color-primary)',
      hex: '3B82F6',
      alpha: 100,
    })
  })
})

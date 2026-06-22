import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShadowSection } from './shadow-section'

vi.mock('../ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render }: { render: React.ReactElement }) => render,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../ui/color-picker', () => ({
  ColorPickerPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ColorPickerGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

afterEach(cleanup)

describe('ShadowSection', () => {
  it('renders add button and no layers when no shadow is present', () => {
    const { container } = render(
      <ShadowSection boxShadow="none" onSetCSS={vi.fn()} pendingStyles={{}} />
    )

    expect(container.querySelectorAll('button').length).toBe(1)
    expect(container.querySelectorAll('input[type="number"]').length).toBe(0)
  })

  it('renders layer editor for an existing shadow', () => {
    const { container } = render(
      <ShadowSection
        boxShadow="0px 4px 6px 0px rgba(0,0,0,0.1)"
        onSetCSS={vi.fn()}
        pendingStyles={{}}
      />
    )

    expect(container.querySelectorAll('input[type="number"]').length).toBeGreaterThan(0)
  })

  it('disables add at the layer cap', () => {
    const onCommitShadowLayers = vi.fn()
    const shadow16 = Array.from({ length: 16 }, () => '0px 4px 6px 0px rgba(0,0,0,0.1)').join(', ')
    const { container } = render(
      <ShadowSection
        boxShadow={shadow16}
        onCommitShadowLayers={onCommitShadowLayers}
        pendingStyles={{}}
      />
    )

    const plusButton = container.querySelector('button') as HTMLButtonElement
    expect(plusButton.disabled).toBe(true)
    fireEvent.click(plusButton)
    expect(onCommitShadowLayers).not.toHaveBeenCalled()
  })

  it('does not reset committed layers on stale pre-echo props', () => {
    const onCommitShadowLayers = vi.fn()
    const { container, rerender } = render(
      <ShadowSection
        boxShadow="none"
        onCommitShadowLayers={onCommitShadowLayers}
        pendingStyles={{}}
      />
    )

    fireEvent.click(container.querySelector('button') as HTMLButtonElement)
    expect(onCommitShadowLayers).toHaveBeenCalledTimes(1)

    act(() => {
      rerender(
        <ShadowSection
          boxShadow="none"
          onCommitShadowLayers={onCommitShadowLayers}
          pendingStyles={{ 'box-shadow': 'none' }}
        />
      )
    })

    expect(container.querySelectorAll('input[type="number"]').length).toBeGreaterThan(0)
  })
})

import * as React from 'react'
import { cleanup, render, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackgroundFillSection } from './fill-section'
import type { ColorValue } from '../types'

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

const transparent: ColorValue = { hex: '000000', alpha: 0, raw: 'transparent' }
const visible: ColorValue = { hex: 'FF0000', alpha: 100, raw: '#FF0000' }

describe('BackgroundFillSection', () => {
  it('renders + button when no fill layers', () => {
    const onSetCSS = vi.fn()
    const { container } = render(
      <BackgroundFillSection backgroundColor={transparent} onSetCSS={onSetCSS} pendingStyles={{}} />,
    )
    // No color input should be rendered
    expect(container.querySelector('input')).toBeNull()
    // + button should exist
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(1)
  })

  it('renders ColorInput per layer when fills exist', () => {
    const onSetCSS = vi.fn()
    const { container } = render(
      <BackgroundFillSection backgroundColor={visible} onSetCSS={onSetCSS} pendingStyles={{}} />,
    )
    // Color input should be rendered (hex input)
    expect(container.querySelector('input')).not.toBeNull()
  })

  it('clicking + calls onSetCSS with correct background-color', () => {
    const onSetCSS = vi.fn()
    const { container } = render(
      <BackgroundFillSection backgroundColor={transparent} onSetCSS={onSetCSS} pendingStyles={{}} />,
    )
    const button = container.querySelector('button')!
    fireEvent.click(button)
    expect(onSetCSS).toHaveBeenCalledWith({
      'background-color': '#DDDDDD',
      background: '',
    })
  })

  it('clicking - calls onSetCSS with transparent', () => {
    const onSetCSS = vi.fn()
    const { container } = render(
      <BackgroundFillSection backgroundColor={visible} onSetCSS={onSetCSS} pendingStyles={{}} />,
    )
    // The - button is associated with the layer
    const buttons = container.querySelectorAll('button')
    // Find the minus button (last button in the layer row)
    const minusButton = Array.from(buttons).find((btn) =>
      btn.closest('[class*="shrink-0"]') && btn !== buttons[0],
    ) ?? buttons[buttons.length - 1]
    fireEvent.click(minusButton)
    expect(onSetCSS).toHaveBeenCalledWith({
      'background-color': 'transparent',
      background: '',
    })
  })

  it('multi-layer: + adds second layer, serializes to background with gradients', () => {
    const onSetCSS = vi.fn()
    const { container } = render(
      <BackgroundFillSection backgroundColor={visible} onSetCSS={onSetCSS} pendingStyles={{}} />,
    )
    // Click the + button in the header to add a second layer
    const buttons = container.querySelectorAll('button')
    const plusButton = buttons[0]
    fireEvent.click(plusButton)
    expect(onSetCSS).toHaveBeenCalledWith({
      background: 'linear-gradient(#FF0000, #FF0000), linear-gradient(#DDDDDD, #DDDDDD)',
      'background-color': '',
    })
  })
})

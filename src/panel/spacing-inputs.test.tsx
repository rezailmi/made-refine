import * as React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SpacingInputs } from './spacing-inputs'
import type { CSSPropertyValue } from '../types'

vi.mock('../ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render }: { render: React.ReactElement }) => render,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function value(numericValue: number): CSSPropertyValue {
  return {
    numericValue,
    unit: 'px',
    raw: `${numericValue}px`,
  }
}

describe('SpacingInputs', () => {
  afterEach(() => {
    cleanup()
  })

  it('clamps padding values to non-negative numbers', () => {
    const onChange = vi.fn()

    const { getAllByRole } = render(
      <SpacingInputs
        prefix="padding"
        values={{
          top: value(0),
          right: value(0),
          bottom: value(0),
          left: value(0),
        }}
        onChange={onChange}
      />,
    )

    const [horizontalInput] = getAllByRole('spinbutton')
    fireEvent.change(horizontalInput, { target: { value: '-12' } })

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, 'paddingLeft', { numericValue: 0, unit: 'px', raw: '0px' })
    expect(onChange).toHaveBeenNthCalledWith(2, 'paddingRight', { numericValue: 0, unit: 'px', raw: '0px' })
  })

  it('allows negative margin values', () => {
    const onChange = vi.fn()

    const { getAllByRole } = render(
      <SpacingInputs
        prefix="margin"
        values={{
          top: value(0),
          right: value(0),
          bottom: value(0),
          left: value(0),
        }}
        onChange={onChange}
      />,
    )

    const [horizontalInput] = getAllByRole('spinbutton')
    fireEvent.change(horizontalInput, { target: { value: '-12' } })

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, 'marginLeft', { numericValue: -12, unit: 'px', raw: '-12px' })
    expect(onChange).toHaveBeenNthCalledWith(2, 'marginRight', { numericValue: -12, unit: 'px', raw: '-12px' })
  })

  it('shows mixed for combined values and applies the override to both sides', () => {
    const onChange = vi.fn()

    const { getAllByRole } = render(
      <SpacingInputs
        prefix="padding"
        values={{
          top: value(8),
          right: value(16),
          bottom: value(8),
          left: value(4),
        }}
        onChange={onChange}
      />,
    )

    const [horizontalInput, verticalInput] = getAllByRole('spinbutton') as HTMLInputElement[]
    expect(horizontalInput.placeholder).toBe('mixed')
    expect(horizontalInput.value).toBe('')
    expect(verticalInput.value).toBe('8')

    fireEvent.change(horizontalInput, { target: { value: '24' } })

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, 'paddingLeft', { numericValue: 24, unit: 'px', raw: '24px' })
    expect(onChange).toHaveBeenNthCalledWith(2, 'paddingRight', { numericValue: 24, unit: 'px', raw: '24px' })
  })
})

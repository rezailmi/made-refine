import * as React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BorderRadiusInputs } from './border-radius-inputs'
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

describe('BorderRadiusInputs', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows mixed in combined mode and applies typed overrides to all corners', () => {
    const onChange = vi.fn()

    const { getByRole } = render(
      <BorderRadiusInputs
        values={{
          topLeft: value(4),
          topRight: value(8),
          bottomRight: value(12),
          bottomLeft: value(16),
        }}
        onChange={onChange}
      />,
    )

    const input = getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('mixed')

    fireEvent.change(input, { target: { value: '20' } })

    expect(onChange).toHaveBeenCalledTimes(4)
    expect(onChange).toHaveBeenNthCalledWith(1, 'borderTopLeftRadius', { numericValue: 20, unit: 'px', raw: '20px' })
    expect(onChange).toHaveBeenNthCalledWith(2, 'borderTopRightRadius', { numericValue: 20, unit: 'px', raw: '20px' })
    expect(onChange).toHaveBeenNthCalledWith(3, 'borderBottomRightRadius', { numericValue: 20, unit: 'px', raw: '20px' })
    expect(onChange).toHaveBeenNthCalledWith(4, 'borderBottomLeftRadius', { numericValue: 20, unit: 'px', raw: '20px' })
  })
})

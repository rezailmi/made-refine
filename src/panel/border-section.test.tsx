import * as React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BorderInputs } from './border-section'
import type { BorderProperties, CSSPropertyValue } from '../types'

vi.mock('../ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render }: { render: React.ReactElement }) => render,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../ui/simple-select', () => ({
  SimpleSelect: ({
    value,
    onValueChange,
    options,
  }: {
    value: string
    onValueChange: (value: string) => void
    options: Array<{ value: string; label: string }>
  }) => (
    <select
      data-testid={`simple-select-${options.map((option) => option.value).join('-')}`}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

function cssValue(numericValue: number): CSSPropertyValue {
  return {
    numericValue,
    unit: 'px',
    raw: `${numericValue}px`,
  }
}

function border(top: number, right: number, bottom: number, left: number): BorderProperties {
  return {
    borderTopStyle: 'solid',
    borderTopWidth: cssValue(top),
    borderRightStyle: 'solid',
    borderRightWidth: cssValue(right),
    borderBottomStyle: 'solid',
    borderBottomWidth: cssValue(bottom),
    borderLeftStyle: 'solid',
    borderLeftWidth: cssValue(left),
  }
}

describe('BorderInputs', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows mixed for width in All mode and overrides all sides when edited', () => {
    const onBatchChange = vi.fn()

    const { getByPlaceholderText } = render(
      <BorderInputs
        border={border(3, 1, 2, 4)}
        onChange={vi.fn()}
        onBatchChange={onBatchChange}
        borderPosition="border"
        borderStyleControlPreference="label"
        onPositionChange={vi.fn()}
      />,
    )

    const widthInput = getByPlaceholderText('mixed')
    fireEvent.change(widthInput, { target: { value: '6' } })

    expect(onBatchChange).toHaveBeenCalledTimes(1)
    expect(onBatchChange).toHaveBeenNthCalledWith(1, [
      ['borderTopWidth', { numericValue: 6, unit: 'px', raw: '6px' }],
      ['borderRightWidth', { numericValue: 6, unit: 'px', raw: '6px' }],
      ['borderBottomWidth', { numericValue: 6, unit: 'px', raw: '6px' }],
      ['borderLeftWidth', { numericValue: 6, unit: 'px', raw: '6px' }],
    ])
  })

  it('preserves selected side width when switching from mixed All state to a single side', () => {
    const onBatchChange = vi.fn()

    const { getByTestId } = render(
      <BorderInputs
        border={border(3, 1, 2, 4)}
        onChange={vi.fn()}
        onBatchChange={onBatchChange}
        borderPosition="border"
        borderStyleControlPreference="label"
        onPositionChange={vi.fn()}
      />,
    )

    const sideSelect = getByTestId('simple-select-All-Top-Right-Bottom-Left-Custom')
    fireEvent.change(sideSelect, { target: { value: 'Top' } })

    expect(onBatchChange).toHaveBeenCalledTimes(1)
    expect(onBatchChange).toHaveBeenNthCalledWith(1, [
      ['borderTopWidth', { numericValue: 3, unit: 'px', raw: '3px' }],
      ['borderRightWidth', { numericValue: 0, unit: 'px', raw: '0px' }],
      ['borderBottomWidth', { numericValue: 0, unit: 'px', raw: '0px' }],
      ['borderLeftWidth', { numericValue: 0, unit: 'px', raw: '0px' }],
    ])
  })
})

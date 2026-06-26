import * as React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TypographyInputs } from './typography-inputs'
import type { TypographyProperties } from '../types'

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
      data-testid="simple-select"
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

afterEach(cleanup)

const typography: TypographyProperties = {
  fontFamily: 'system-ui, sans-serif',
  fontWeight: '600',
  fontSize: { numericValue: 16, unit: 'px', raw: '16px' },
  lineHeight: { numericValue: 28, unit: 'px', raw: '28px' },
  letterSpacing: { numericValue: 0, unit: 'em', raw: '0em' },
  textAlign: 'left',
  textVerticalAlign: 'flex-start',
  textDecoration: 'none',
  textTransform: 'none',
  fontStyle: 'normal',
}

describe('TypographyInputs token awareness', () => {
  it('shows utility chips for attributed size, weight, and line-height', () => {
    const { container } = render(
      <TypographyInputs
        typography={typography}
        onUpdate={vi.fn()}
        classList={['text-base', 'font-semibold', 'leading-7']}
      />,
    )
    expect(container.textContent).toContain('text-base')
    expect(container.textContent).toContain('font-semibold')
    expect(container.textContent).toContain('leading-7')
    // Only letter-spacing (unattributed) stays a raw number input at the row level;
    // size / line-height moved into their chip popovers.
    expect(container.querySelectorAll('input[type="number"]').length).toBe(1)
  })

  it('renders the raw controls when no utility is attributed (fallback)', () => {
    const { container } = render(
      <TypographyInputs typography={typography} onUpdate={vi.fn()} classList={[]} />,
    )
    // size + line-height + letter-spacing all render as raw number inputs.
    expect(container.querySelectorAll('input[type="number"]').length).toBe(3)
    expect(container.textContent).not.toContain('text-base')
  })

  it('attributes arbitrary font-size values', () => {
    const { container } = render(
      <TypographyInputs typography={typography} onUpdate={vi.fn()} classList={['text-[17px]']} />,
    )
    expect(container.textContent).toContain('text-[17px]')
  })
})

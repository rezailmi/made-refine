import * as React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LayoutSection } from './layout-section'
import type { CSSPropertyValue } from '../types'

vi.mock('./shared', () => ({
  Tip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CollapsibleSection: ({
    children,
    actions,
  }: {
    children: React.ReactNode
    actions?: React.ReactNode
  }) => (
    <div data-testid="collapsible-section">
      {actions}
      {children}
    </div>
  ),
}))

vi.mock('./alignment-grid', () => ({
  AlignmentGrid: () => <div data-testid="alignment-grid" />,
}))

vi.mock('./spacing-inputs', () => ({
  SpacingInputs: () => <div data-testid="spacing-inputs" />,
}))

vi.mock('./sizing-inputs', () => ({
  SizingInputs: () => <div data-testid="sizing-inputs" />,
  SizingFixedInput: () => <input data-testid="sizing-fixed-input" />,
  DISTRIBUTE_MODES: ['fixed'],
  DISTRIBUTE_LABELS: { fixed: 'Fixed' } as Record<string, string>,
}))

vi.mock('../ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  SelectPortal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectPositioner: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectPopup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectItemIndicator: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SelectItemText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('../ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode
    onClick?: () => void
    [key: string]: unknown
  }) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}))

function cssValue(raw = '0px'): CSSPropertyValue {
  return { raw, numericValue: Number.parseFloat(raw) || 0, unit: 'px' }
}

function baseSpacing() {
  return {
    paddingTop: cssValue(),
    paddingRight: cssValue(),
    paddingBottom: cssValue(),
    paddingLeft: cssValue(),
    marginTop: cssValue(),
    marginRight: cssValue(),
    marginBottom: cssValue(),
    marginLeft: cssValue(),
    gap: cssValue(),
  }
}

function makeProps(overrides: {
  isFlexContainer?: boolean
  hasChildren?: boolean
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse'
  onToggleFlex?: () => void
  onUpdateFlex?: (key: string, value: string) => void
  overflow?: 'visible' | 'hidden' | 'auto' | 'scroll'
  onUpdateOverflow?: (value: 'visible' | 'hidden' | 'auto' | 'scroll') => void
}) {
  const sectionRef = vi.fn()
  return {
    elementInfo: {
      isFlexContainer: overrides.isFlexContainer ?? false,
      hasChildren: overrides.hasChildren ?? false,
    },
    computedFlex: {
      flexDirection: overrides.flexDirection ?? 'row',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      flexWrap: overrides.flexWrap ?? 'nowrap',
    },
    computedSpacing: baseSpacing(),
    computedSizing: null,
    onToggleFlex: overrides.onToggleFlex,
    onUpdateFlex: overrides.onUpdateFlex ?? vi.fn(),
    onUpdateSpacing: vi.fn(),
    onUpdateSizing: vi.fn(),
    overflow: overrides.overflow,
    onUpdateOverflow: overrides.onUpdateOverflow,
    sectionRef,
  }
}

afterEach(() => {
  cleanup()
})

describe('LayoutSection empty state', () => {
  it('renders and calls Add flex layout when onToggleFlex is provided', () => {
    const onToggleFlex = vi.fn()
    const { getByText } = render(
      <LayoutSection {...makeProps({ isFlexContainer: false, onToggleFlex })} />
    )

    fireEvent.click(getByText('Add flex layout'))
    expect(onToggleFlex).toHaveBeenCalledTimes(1)
  })

  it('does not render Add flex layout when onToggleFlex is absent', () => {
    const { queryByText } = render(<LayoutSection {...makeProps({ isFlexContainer: false })} />)
    expect(queryByText('Add flex layout')).toBeNull()
  })
})

describe('LayoutSection flex controls', () => {
  it('toggles flex wrap on and off', () => {
    const onUpdateFlex = vi.fn()
    const first = render(
      <LayoutSection {...makeProps({ isFlexContainer: true, flexWrap: 'nowrap', onUpdateFlex })} />
    )

    fireEvent.click(first.getByLabelText('Wrap'))
    expect(onUpdateFlex).toHaveBeenCalledWith('flexWrap', 'wrap')
    cleanup()
    onUpdateFlex.mockClear()

    const second = render(
      <LayoutSection {...makeProps({ isFlexContainer: true, flexWrap: 'wrap', onUpdateFlex })} />
    )
    fireEvent.click(second.getByLabelText('Wrap'))
    expect(onUpdateFlex).toHaveBeenCalledWith('flexWrap', 'nowrap')
  })

  it('toggles row direction between normal and reverse', () => {
    const onUpdateFlex = vi.fn()
    const first = render(
      <LayoutSection
        {...makeProps({ isFlexContainer: true, flexDirection: 'row', onUpdateFlex })}
      />
    )

    fireEvent.click(first.getByLabelText('Row'))
    expect(onUpdateFlex).toHaveBeenCalledWith('flexDirection', 'row-reverse')
    cleanup()
    onUpdateFlex.mockClear()

    const second = render(
      <LayoutSection
        {...makeProps({ isFlexContainer: true, flexDirection: 'row-reverse', onUpdateFlex })}
      />
    )
    fireEvent.click(second.getByLabelText('Row (reversed)'))
    expect(onUpdateFlex).toHaveBeenCalledWith('flexDirection', 'row')
  })
})

describe('LayoutSection clip content', () => {
  it('is hidden unless overflow writes are available and the element has children', () => {
    expect(
      render(
        <LayoutSection
          {...makeProps({ hasChildren: false, overflow: 'visible', onUpdateOverflow: vi.fn() })}
        />
      ).queryByText('Clip content')
    ).toBeNull()
    cleanup()

    expect(
      render(
        <LayoutSection {...makeProps({ hasChildren: true, overflow: 'hidden' })} />
      ).queryByText('Clip content')
    ).toBeNull()
  })

  it('maps visible to unchecked and hidden to checked', () => {
    const visible = render(
      <LayoutSection
        {...makeProps({ hasChildren: true, overflow: 'visible', onUpdateOverflow: vi.fn() })}
      />
    )
    expect(visible.getByRole('checkbox').getAttribute('aria-checked')).toBe('false')
    cleanup()

    const hidden = render(
      <LayoutSection
        {...makeProps({ hasChildren: true, overflow: 'hidden', onUpdateOverflow: vi.fn() })}
      />
    )
    expect(hidden.getByRole('checkbox').getAttribute('aria-checked')).toBe('true')
  })

  it('checking writes hidden and unchecking writes visible', () => {
    const onUpdateOverflow = vi.fn()
    const visible = render(
      <LayoutSection {...makeProps({ hasChildren: true, overflow: 'visible', onUpdateOverflow })} />
    )
    fireEvent.click(visible.getByRole('checkbox'))
    expect(onUpdateOverflow).toHaveBeenCalledWith('hidden')
    cleanup()
    onUpdateOverflow.mockClear()

    const hidden = render(
      <LayoutSection {...makeProps({ hasChildren: true, overflow: 'hidden', onUpdateOverflow })} />
    )
    fireEvent.click(hidden.getByRole('checkbox'))
    expect(onUpdateOverflow).toHaveBeenCalledWith('visible')
  })
})

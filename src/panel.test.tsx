import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DirectEditPanelInner } from './panel'
import { DirectEditProvider } from './provider'
import type { CSSPropertyValue, ColorValue } from './types'

function cssValue(raw: string, numericValue = Number.parseFloat(raw) || 0): CSSPropertyValue {
  return {
    raw,
    numericValue,
    unit: raw.endsWith('%') ? '%' : 'px',
  }
}

function colorValue(hex: string, raw = `#${hex}`): ColorValue {
  return { hex, alpha: 100, raw }
}

describe('DirectEditPanelInner', () => {
  it('renders the legacy footer actions when export/send props are provided', () => {
    const { container } = render(
      <DirectEditProvider>
        <DirectEditPanelInner
          elementInfo={{
            tagName: 'div',
            id: null,
            classList: [],
            isFlexContainer: false,
            isFlexItem: false,
            isTextElement: false,
            parentElement: null,
            hasChildren: false,
          }}
          computedSpacing={{
            paddingTop: cssValue('0px'),
            paddingRight: cssValue('0px'),
            paddingBottom: cssValue('0px'),
            paddingLeft: cssValue('0px'),
            marginTop: cssValue('0px'),
            marginRight: cssValue('0px'),
            marginBottom: cssValue('0px'),
            marginLeft: cssValue('0px'),
            gap: cssValue('0px'),
          }}
          computedBorderRadius={{
            borderTopLeftRadius: cssValue('0px'),
            borderTopRightRadius: cssValue('0px'),
            borderBottomRightRadius: cssValue('0px'),
            borderBottomLeftRadius: cssValue('0px'),
          }}
          computedBorder={{
            borderTopStyle: 'solid',
            borderTopWidth: cssValue('1px', 1),
            borderRightStyle: 'solid',
            borderRightWidth: cssValue('1px', 1),
            borderBottomStyle: 'solid',
            borderBottomWidth: cssValue('1px', 1),
            borderLeftStyle: 'solid',
            borderLeftWidth: cssValue('1px', 1),
          }}
          computedFlex={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'stretch',
          }}
          computedSizing={{
            width: { mode: 'fixed', value: cssValue('320px', 320) },
            height: { mode: 'fixed', value: cssValue('120px', 120) },
          }}
          computedColor={{
            backgroundColor: colorValue('FFFFFF'),
            color: colorValue('111111'),
            borderColor: colorValue('CCCCCC'),
            outlineColor: colorValue('000000', 'rgba(0,0,0,0)'),
          }}
          computedTypography={null}
          pendingStyles={{ color: '#111111' }}
          onUpdateSpacing={() => {}}
          onUpdateBorderRadius={() => {}}
          onUpdateBorder={() => {}}
          onBatchUpdateBorder={() => {}}
          onSetCSS={() => {}}
          onUpdateFlex={() => {}}
          onToggleFlex={() => {}}
          onUpdateSizing={() => {}}
          onUpdateColor={() => {}}
          onReplaceSelectionColor={() => {}}
          onUpdateTypography={() => {}}
          onReset={() => {}}
          onExportEdits={vi.fn().mockResolvedValue(true)}
          onSendToAgent={vi.fn().mockResolvedValue(true)}
          canSendToAgent={true}
        />
      </DirectEditProvider>,
    )

    expect(container.querySelector('button[aria-label="Copy edits"]')).not.toBeNull()
    expect(container.querySelector('button[aria-label="Apply changes via agent"]')).not.toBeNull()
  })
})

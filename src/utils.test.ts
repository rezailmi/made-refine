import { describe, expect, it, vi } from 'vitest'
import {
  ensureDirectTextSpanAtPoint,
  getComputedColorStyles,
  ORIGINAL_STYLE_PROPS,
  propertyToCSSMap,
  borderRadiusPropertyToCSSMap,
  borderPropertyToCSSMap,
  flexPropertyToCSSMap,
  sizingPropertyToCSSMap,
  colorPropertyToCSSMap,
  typographyPropertyToCSSMap,
  stylesToTailwind,
  collapseSpacingShorthands,
  collapseExportShorthands,
  buildElementContext,
  buildEditExport,
  buildCommentExport,
  buildSessionExport,
  getExportContentProfile,
  buildExportInstruction,
  getElementLocator,
  computeIntendedIndex,
} from './utils'
import type { ElementLocator, SessionEdit } from './types'

describe('getComputedColorStyles', () => {
  it('uses the first visible side when top border is not visible', () => {
    const el = document.createElement('div')
    el.style.borderTopStyle = 'none'
    el.style.borderTopWidth = '0px'
    el.style.borderTopColor = 'rgb(255, 0, 0)'
    el.style.borderRightStyle = 'solid'
    el.style.borderRightWidth = '2px'
    el.style.borderRightColor = 'rgb(0, 255, 0)'
    el.style.borderBottomStyle = 'none'
    el.style.borderBottomWidth = '0px'
    el.style.borderLeftStyle = 'none'
    el.style.borderLeftWidth = '0px'
    document.body.appendChild(el)

    const color = getComputedColorStyles(el)

    expect(color.borderColor.hex).toBe('00FF00')
    expect(color.borderColor.alpha).toBe(100)
    el.remove()
  })

  it('returns transparent border color when all sides are not visible', () => {
    const el = document.createElement('div')
    el.style.borderTopStyle = 'none'
    el.style.borderTopWidth = '0px'
    el.style.borderRightStyle = 'hidden'
    el.style.borderRightWidth = '2px'
    el.style.borderBottomStyle = 'none'
    el.style.borderBottomWidth = '0px'
    el.style.borderLeftStyle = 'none'
    el.style.borderLeftWidth = '0px'
    document.body.appendChild(el)

    const color = getComputedColorStyles(el)

    expect(color.borderColor.alpha).toBe(0)
    el.remove()
  })
})

describe('stylesToTailwind', () => {
  describe('border-style shorthand', () => {
    it('maps border-style to Tailwind class', () => {
      expect(stylesToTailwind({ 'border-style': 'solid' })).toBe('border-solid')
      expect(stylesToTailwind({ 'border-style': 'dashed' })).toBe('border-dashed')
      expect(stylesToTailwind({ 'border-style': 'dotted' })).toBe('border-dotted')
      expect(stylesToTailwind({ 'border-style': 'double' })).toBe('border-double')
      expect(stylesToTailwind({ 'border-style': 'none' })).toBe('border-none')
    })
  })

  describe('per-side border-style with all four sides present', () => {
    it('consolidates to shorthand when all sides match', () => {
      const result = stylesToTailwind({
        'border-top-style': 'solid',
        'border-right-style': 'solid',
        'border-bottom-style': 'solid',
        'border-left-style': 'solid',
      })
      expect(result).toBe('border-solid')
    })

    it('emits per-side arbitrary classes when all four sides are present but differ', () => {
      const result = stylesToTailwind({
        'border-top-style': 'solid',
        'border-right-style': 'dashed',
        'border-bottom-style': 'solid',
        'border-left-style': 'solid',
      })
      expect(result).toBe('[border-top-style:solid] [border-right-style:dashed] [border-bottom-style:solid] [border-left-style:solid]')
    })
  })

  describe('per-side border-style with partial sides', () => {
    it('emits arbitrary-property Tailwind for a single side', () => {
      expect(stylesToTailwind({ 'border-top-style': 'solid' })).toBe('[border-top-style:solid]')
      expect(stylesToTailwind({ 'border-right-style': 'dashed' })).toBe('[border-right-style:dashed]')
      expect(stylesToTailwind({ 'border-bottom-style': 'dotted' })).toBe('[border-bottom-style:dotted]')
      expect(stylesToTailwind({ 'border-left-style': 'double' })).toBe('[border-left-style:double]')
    })

    it('emits arbitrary-property Tailwind for two sides', () => {
      const result = stylesToTailwind({
        'border-top-style': 'solid',
        'border-bottom-style': 'dashed',
      })
      expect(result).toBe('[border-top-style:solid] [border-bottom-style:dashed]')
    })
  })

  describe('other border properties', () => {
    it('maps border-color', () => {
      expect(stylesToTailwind({ 'border-color': 'rgb(0, 0, 0)' })).toContain('border-')
    })
  })

  describe('spacing properties', () => {
    it('maps padding to Tailwind', () => {
      expect(stylesToTailwind({ 'padding-top': '16px' })).toBe('pt-4')
    })

    it('maps margin to Tailwind', () => {
      expect(stylesToTailwind({ 'margin-left': '8px' })).toBe('ml-2')
    })

    it('uses arbitrary value for non-scale values', () => {
      expect(stylesToTailwind({ 'padding-top': '13px' })).toBe('pt-[13px]')
    })

    it('maps shorthand padding to p-*', () => {
      expect(stylesToTailwind({ padding: '16px' })).toBe('p-4')
    })

    it('maps padding-inline to px-*', () => {
      expect(stylesToTailwind({ 'padding-inline': '8px' })).toBe('px-2')
    })

    it('maps padding-block to py-*', () => {
      expect(stylesToTailwind({ 'padding-block': '4px' })).toBe('py-1')
    })

    it('maps shorthand margin to m-*', () => {
      expect(stylesToTailwind({ margin: '16px' })).toBe('m-4')
    })

    it('maps margin-inline to mx-*', () => {
      expect(stylesToTailwind({ 'margin-inline': '8px' })).toBe('mx-2')
    })

    it('maps margin-block to my-*', () => {
      expect(stylesToTailwind({ 'margin-block': '4px' })).toBe('my-1')
    })
  })

  describe('display', () => {
    it('maps display values', () => {
      expect(stylesToTailwind({ display: 'flex' })).toBe('flex')
      expect(stylesToTailwind({ display: 'none' })).toBe('hidden')
      expect(stylesToTailwind({ display: 'grid' })).toBe('grid')
    })
  })

  describe('width and height', () => {
    it('maps known width values', () => {
      expect(stylesToTailwind({ width: '100%' })).toBe('w-full')
      expect(stylesToTailwind({ width: 'fit-content' })).toBe('w-fit')
    })

    it('uses arbitrary value for unknown widths', () => {
      expect(stylesToTailwind({ width: '200px' })).toBe('w-[200px]')
    })
  })

  describe('box-shadow', () => {
    it('maps none to shadow-none', () => {
      expect(stylesToTailwind({ 'box-shadow': 'none' })).toBe('shadow-none')
    })

    it('maps Tailwind default shadow values to utility classes', () => {
      expect(stylesToTailwind({ 'box-shadow': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' })).toBe('shadow-md')
      expect(stylesToTailwind({ 'box-shadow': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)' })).toBe('shadow-inner')
    })

    it('maps custom shadow values to arbitrary Tailwind syntax', () => {
      expect(stylesToTailwind({ 'box-shadow': '0 4px 6px -1px rgba(0,0,0,0.1)' })).toBe(
        'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]',
      )
    })
  })

  describe('typography', () => {
    it('maps font-weight', () => {
      expect(stylesToTailwind({ 'font-weight': '700' })).toBe('font-bold')
      expect(stylesToTailwind({ 'font-weight': '400' })).toBe('font-normal')
    })

    it('maps text-align', () => {
      expect(stylesToTailwind({ 'text-align': 'center' })).toBe('text-center')
    })
  })
})

describe('ORIGINAL_STYLE_PROPS covers all properties that resetToOriginal removes', () => {
  // resetToOriginal (provider.tsx) builds its removal list from these maps plus
  // hardcoded extras. If a property is removed during reset but missing from
  // ORIGINAL_STYLE_PROPS, original inline values are permanently lost.
  const resetCSSProps = [
    ...new Set([
      ...Object.values(propertyToCSSMap),
      ...Object.values(borderRadiusPropertyToCSSMap),
      ...Object.values(borderPropertyToCSSMap),
      ...Object.values(flexPropertyToCSSMap),
      ...Object.values(sizingPropertyToCSSMap),
      ...Object.values(colorPropertyToCSSMap),
      ...Object.values(typographyPropertyToCSSMap),
      'outline-style',
      'outline-width',
      'box-shadow',
    ]),
  ]

  it('ORIGINAL_STYLE_PROPS is a superset of the reset property list', () => {
    const captureSet = new Set<string>(ORIGINAL_STYLE_PROPS)
    const missing = resetCSSProps.filter((prop) => !captureSet.has(prop))

    expect(missing).toEqual([])
  })
})

describe('collapseSpacingShorthands', () => {
  it('collapses all 4 equal padding sides to shorthand', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '16px',
      'padding-right': '16px',
      'padding-bottom': '16px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ padding: '16px' })
  })

  it('collapses matching horizontal/vertical pairs', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '8px',
      'padding-right': '16px',
      'padding-bottom': '8px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ 'padding-inline': '16px', 'padding-block': '8px' })
  })

  it('collapses only horizontal pair when vertical differs', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '8px',
      'padding-right': '16px',
      'padding-bottom': '12px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ 'padding-top': '8px', 'padding-inline': '16px', 'padding-bottom': '12px' })
  })

  it('collapses only vertical pair when horizontal differs', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '8px',
      'padding-right': '16px',
      'padding-bottom': '8px',
      'padding-left': '12px',
    })
    expect(result).toEqual({ 'padding-block': '8px', 'padding-right': '16px', 'padding-left': '12px' })
  })

  it('does not collapse when all sides differ', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '4px',
      'padding-right': '8px',
      'padding-bottom': '12px',
      'padding-left': '16px',
    })
    expect(result).toEqual({
      'padding-top': '4px',
      'padding-right': '8px',
      'padding-bottom': '12px',
      'padding-left': '16px',
    })
  })

  it('collapses all 4 equal margin sides to shorthand', () => {
    const result = collapseSpacingShorthands({
      'margin-top': '8px',
      'margin-right': '8px',
      'margin-bottom': '8px',
      'margin-left': '8px',
    })
    expect(result).toEqual({ margin: '8px' })
  })

  it('collapses margin horizontal/vertical pairs', () => {
    const result = collapseSpacingShorthands({
      'margin-top': '4px',
      'margin-right': '8px',
      'margin-bottom': '4px',
      'margin-left': '8px',
    })
    expect(result).toEqual({ 'margin-inline': '8px', 'margin-block': '4px' })
  })

  it('overrides existing shorthand values when all sides are present', () => {
    const result = collapseSpacingShorthands({
      padding: '2px',
      'padding-inline': '6px',
      'padding-block': '10px',
      'padding-top': '8px',
      'padding-right': '16px',
      'padding-bottom': '8px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ 'padding-inline': '16px', 'padding-block': '8px' })
  })

  it('passes through non-spacing properties unchanged', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '16px',
      'padding-right': '16px',
      'padding-bottom': '16px',
      'padding-left': '16px',
      display: 'flex',
    })
    expect(result).toEqual({ padding: '16px', display: 'flex' })
  })

  it('handles partial sides without collapsing', () => {
    const result = collapseSpacingShorthands({
      'padding-top': '16px',
      'padding-left': '16px',
    })
    expect(result).toEqual({ 'padding-top': '16px', 'padding-left': '16px' })
  })
})

describe('collapseExportShorthands', () => {
  it('collapses equal border style and radius side properties into shorthands', () => {
    const result = collapseExportShorthands({
      'border-top-left-radius': '0px',
      'border-top-right-radius': '0px',
      'border-bottom-right-radius': '0px',
      'border-bottom-left-radius': '0px',
      'border-top-style': 'solid',
      'border-right-style': 'solid',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
      'border-top-width': '0px',
      'border-right-width': '0px',
      'border-bottom-width': '1px',
      'border-left-width': '0px',
      'padding-inline': '0px',
      'margin-inline': '-12px',
    })

    expect(result).toEqual({
      'border-radius': '0px',
      'border-style': 'solid',
      'border-top-width': '0px',
      'border-right-width': '0px',
      'border-bottom-width': '1px',
      'border-left-width': '0px',
      'padding-inline': '0px',
      'margin-inline': '-12px',
    })
  })

  it('keeps mixed side border styles expanded', () => {
    const result = collapseExportShorthands({
      'border-top-style': 'solid',
      'border-right-style': 'dashed',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
    })

    expect(result).toEqual({
      'border-top-style': 'solid',
      'border-right-style': 'dashed',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
    })
  })

  it('collapses equal side border widths into border-width', () => {
    const result = collapseExportShorthands({
      'border-top-width': '2px',
      'border-right-width': '2px',
      'border-bottom-width': '2px',
      'border-left-width': '2px',
    })

    expect(result).toEqual({
      'border-width': '2px',
    })
  })

  it('drops conflicting border shorthand when mixed side styles are present', () => {
    const result = collapseExportShorthands({
      'border-style': 'solid',
      'border-top-style': 'solid',
      'border-right-style': 'dashed',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
    })

    expect(result).toEqual({
      'border-top-style': 'solid',
      'border-right-style': 'dashed',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
    })
  })
})

describe('locator text preview', () => {
  it('keeps a readable gap between sibling text fragments', () => {
    const target = document.createElement('div')
    target.innerHTML = '<div>Sara mentioned you</div><div>in Design Review #14</div>'
    document.body.appendChild(target)

    const locator = getElementLocator(target)

    expect(locator.textPreview).toBe('Sara mentioned you in Design Review #14')
    expect(locator.targetHtml).toContain('Sara mentioned you in Design Review #14')

    target.remove()
  })
})

describe('ensureDirectTextSpanAtPoint', () => {
  it('wraps the direct text node hit by point', () => {
    const parent = document.createElement('div')
    const text = document.createTextNode('Priority support')
    parent.appendChild(text)
    document.body.appendChild(parent)

    let selected: Text | null = null
    const spy = vi.spyOn(document, 'createRange').mockImplementation(() => ({
      selectNodeContents: (node: Node) => { selected = node as Text },
      getClientRects: () => {
        if (selected !== text) return []
        return [{
          left: 10,
          top: 10,
          right: 150,
          bottom: 30,
          width: 140,
          height: 20,
          x: 10,
          y: 10,
          toJSON: () => ({}),
        }]
      },
      detach: () => {},
    }) as unknown as Range)

    const span = ensureDirectTextSpanAtPoint(parent, 20, 20)
    expect(span).not.toBeNull()
    expect(span?.tagName.toLowerCase()).toBe('span')
    expect(span?.textContent).toBe('Priority support')
    expect(parent.firstChild).toBe(span)

    spy.mockRestore()
    parent.remove()
  })

  it('returns null when click misses direct text rects', () => {
    const parent = document.createElement('div')
    const text = document.createTextNode('Custom domains')
    parent.appendChild(text)
    document.body.appendChild(parent)

    let selected: Text | null = null
    const spy = vi.spyOn(document, 'createRange').mockImplementation(() => ({
      selectNodeContents: (node: Node) => { selected = node as Text },
      getClientRects: () => {
        if (selected !== text) return []
        return [{
          left: 10,
          top: 10,
          right: 80,
          bottom: 20,
          width: 70,
          height: 10,
          x: 10,
          y: 10,
          toJSON: () => ({}),
        }]
      },
      detach: () => {},
    }) as unknown as Range)

    const span = ensureDirectTextSpanAtPoint(parent, 200, 200)
    expect(span).toBeNull()
    expect(parent.firstChild).toBe(text)

    spy.mockRestore()
    parent.remove()
  })
})

function makeLocator(partial?: Partial<ElementLocator>): ElementLocator {
  return {
    reactStack: [{ name: 'Button', file: 'src/components.tsx', line: 52, column: 5 }],
    domSelector: 'main > section:nth-of-type(1) > button:nth-of-type(2)',
    domContextHtml: '<section><button>Get started</button><button data-direct-edit-target="true">Blue surface</button></section>',
    targetHtml: '<button>Blue surface</button>',
    textPreview: 'Blue surface',
    tagName: 'button',
    id: null,
    classList: ['btn', 'btn-primary'],
    domSource: { file: 'src/components.tsx', line: 52, column: 5 },
    ...partial,
  }
}

describe('export context quality', () => {
  it('includes target, context, selector, and text in element context even when source is present', () => {
    const locator = makeLocator()
    const output = buildElementContext(locator)

    expect(output).toContain('@<Button>')
    expect(output).toContain('target:')
    expect(output).toContain('<button>Blue surface</button>')
    expect(output).toContain('context:')
    expect(output).toContain('data-direct-edit-target="true"')
    expect(output).toContain('in src/components.tsx:52:5')
    expect(output).toContain('selector: main > section:nth-of-type(1) > button:nth-of-type(2)')
    expect(output).toContain('text: Blue surface')
  })

  it('does not include component props in element context', () => {
    const locator = makeLocator()
    const output = buildElementContext(locator)

    expect(output).not.toContain('component_props:')
  })

  it('uses the same richer context block for edit exports', () => {
    const locator = makeLocator()
    const output = buildEditExport(locator, { 'padding-top': '12px' })

    expect(output).toContain('target:')
    expect(output).toContain('context:')
    expect(output).toContain('selector: main > section:nth-of-type(1) > button:nth-of-type(2)')
    expect(output).toContain('edits:')
    expect(output).toContain('padding-top: 12px')
  })

  it('uses the same richer context block for comment exports', () => {
    const locator = makeLocator()
    const output = buildCommentExport(locator, 'Increase contrast')

    expect(output).toContain('target:')
    expect(output).toContain('context:')
    expect(output).toContain('selector: main > section:nth-of-type(1) > button:nth-of-type(2)')
    expect(output).toContain('comment: Increase contrast')
  })

  it('includes structured move selectors in session exports', () => {
    const element = document.createElement('div')
    const edit: SessionEdit = {
      element,
      locator: makeLocator(),
      originalStyles: {},
      pendingStyles: {},
      textEdit: null,
      move: {
        fromParentName: 'div',
        toParentName: 'div',
        fromSiblingBefore: null,
        fromSiblingAfter: 'div',
        toSiblingBefore: 'div',
        toSiblingAfter: null,
        fromParentSelector: 'main > div:nth-of-type(1)',
        toParentSelector: 'main > div:nth-of-type(1)',
        fromSiblingBeforeSelector: null,
        fromSiblingAfterSelector: 'main > div:nth-of-type(1) > div:nth-of-type(1)',
        toSiblingBeforeSelector: 'main > div:nth-of-type(1) > div:nth-of-type(3)',
        toSiblingAfterSelector: null,
        fromParentSource: { file: 'src/App.tsx', line: 40, column: 3 },
        fromSiblingBeforeSource: null,
        fromSiblingAfterSource: { file: 'src/App.tsx', line: 42, column: 9 },
        toParentSource: { file: 'src/App.tsx', line: 40, column: 3 },
        toSiblingBeforeSource: { file: 'src/App.tsx', line: 47, column: 9 },
        toSiblingAfterSource: null,
        mode: 'reorder',
        draggedPosition: 'relative',
        fromParentDisplay: 'block',
        fromParentLayout: 'block',
        fromIndex: 0,
        toParentDisplay: 'flex',
        toParentLayout: 'flex',
        toIndex: 2,
      },
    }

    const output = buildSessionExport([edit], [])
    expect(output).toContain('moved:')
    expect(output).toContain('=== LAYOUT MOVE PLAN ===')
    expect(output).toContain('id:')
    expect(output).toContain('type: structural_move')
    expect(output).toContain('parent: main > div:nth-of-type(1)')
    expect(output).toContain('current_anchor:')
    expect(output).toContain('target_anchor:')
    expect(output).toContain('implementation_steps:')
    expect(output).toContain('guardrails:')
    expect(output).toContain('instruction:')
    expect(output).not.toContain('from_parent_display:')
    expect(output).not.toContain('to_parent_display:')
    expect(output).not.toContain('layout_intent:')
  })

  it('exports position move with structural metadata and applied left/top', () => {
    const edit: SessionEdit = {
      element: document.createElement('div'),
      locator: {
        tagName: 'div',
        id: 'card',
        classList: [],
        domSelector: '#card',
        targetHtml: '<div id="card">',
        textPreview: '',
        reactStack: [],
        domSource: { file: 'src/App.tsx', line: 10, column: 5 },
      },
      originalStyles: {},
      pendingStyles: { 'background-color': 'red' },
      textEdit: null,
      move: {
        mode: 'position',
        positionDelta: { x: 50, y: 30 },
        appliedLeft: '60px',
        appliedTop: '30px',
        fromParentName: 'section',
        toParentName: 'section',
        fromSiblingBefore: null,
        fromSiblingAfter: 'div (second)',
        toSiblingBefore: 'div (second)',
        toSiblingAfter: null,
        fromParentSelector: 'main > section',
        fromSiblingBeforeSelector: null,
        fromSiblingAfterSelector: 'main > section > div:nth-of-type(2)',
        toParentSelector: 'main > section',
        toSiblingBeforeSelector: 'main > section > div:nth-of-type(2)',
        toSiblingAfterSelector: null,
        fromParentSource: { file: 'src/App.tsx', line: 20, column: 3 },
        fromSiblingBeforeSource: null,
        fromSiblingAfterSource: { file: 'src/App.tsx', line: 22, column: 5 },
        toParentSource: { file: 'src/App.tsx', line: 20, column: 3 },
        toSiblingBeforeSource: { file: 'src/App.tsx', line: 22, column: 5 },
        toSiblingAfterSource: null,
        fromParentDisplay: 'block',
        fromParentLayout: 'block',
        toParentDisplay: 'block',
        toParentLayout: 'block',
        draggedPosition: 'relative',
        fromIndex: 0,
        toIndex: 1,
      },
    }

    const output = buildSessionExport([edit], [])
    expect(output).toContain('moved:')
    expect(output).toContain('id:')
    expect(output).toContain('type: layout_refactor')
    expect(output).toContain('parent: main > section')
    expect(output).toContain('visual_hint: 50px horizontal, 30px vertical')
    expect(output).toContain('recommended_layout:')
    expect(output).toContain('implementation_steps:')
    expect(output).not.toContain('applied_left')
    expect(output).not.toContain('applied_top')
    expect(output).toContain('background-color')
  })

  it('treats no-op move metadata as no move in export instructions', () => {
    const edit: SessionEdit = {
      element: document.createElement('div'),
      locator: makeLocator(),
      originalStyles: {},
      pendingStyles: { color: 'red' },
      textEdit: null,
      move: {
        fromParentName: 'div',
        toParentName: 'div',
        fromSiblingBefore: 'h1',
        fromSiblingAfter: 'p',
        toSiblingBefore: 'h1',
        toSiblingAfter: 'p',
        fromParentSelector: '#root > div',
        toParentSelector: '#root > div',
        mode: 'reorder',
        fromIndex: 1,
        toIndex: 1,
        visualDelta: { x: 0, y: 0 },
      },
    }

    const profile = getExportContentProfile([edit], [], null)
    expect(profile.hasMoves).toBe(false)
    const instruction = buildExportInstruction(profile)
    expect(instruction).toContain('Apply the CSS changes')
    expect(instruction).not.toContain('Implement the move plan below')
  })

  it('anchors deep selectors to a stable root', () => {
    const root = document.createElement('div')
    root.id = 'selector-anchor-root'
    const level1 = document.createElement('div')
    const level2 = document.createElement('div')
    const level3 = document.createElement('div')
    const level4 = document.createElement('div')
    const target = document.createElement('span')
    target.textContent = 'Deep target'
    level4.appendChild(target)
    level3.appendChild(level4)
    level2.appendChild(level3)
    level1.appendChild(level2)
    root.appendChild(level1)
    document.body.appendChild(root)

    const locator = getElementLocator(target)
    expect(locator.domSelector.startsWith('#selector-anchor-root >')).toBe(true)
    root.remove()
  })

  it('sanitizes context and keeps a small sibling window', () => {
    const root = document.createElement('div')
    root.id = 'context-window-root'
    const parent = document.createElement('div')
    root.appendChild(parent)

    const farPrev = document.createElement('div')
    farPrev.textContent = 'far-prev'
    farPrev.setAttribute('style', 'color:red')
    farPrev.setAttribute('data-direct-edit-source', 'src/App.tsx:1:1')

    const prev = document.createElement('div')
    prev.textContent = 'prev'
    prev.setAttribute('style', 'color:blue')

    const target = document.createElement('div')
    target.textContent = 'target'
    target.setAttribute('style', 'color:green')
    target.setAttribute('data-direct-edit-source', 'src/App.tsx:10:3')

    const next = document.createElement('div')
    next.textContent = 'next'
    next.setAttribute('style', 'color:purple')

    const farNext = document.createElement('div')
    farNext.textContent = 'far-next'
    farNext.setAttribute('style', 'color:orange')

    parent.append(farPrev, prev, target, next, farNext)
    document.body.appendChild(root)

    const locator = getElementLocator(target)
    expect(locator.domContextHtml).toContain('prev')
    expect(locator.domContextHtml).toContain('target')
    expect(locator.domContextHtml).toContain('next')
    expect(locator.domContextHtml).not.toContain('far-prev')
    expect(locator.domContextHtml).not.toContain('far-next')
    expect(locator.domContextHtml).not.toContain('style=')
    expect(locator.domContextHtml).not.toContain('data-direct-edit-source')
    root.remove()
  })

  it('builds text previews with spacing across nested text nodes', () => {
    const wrapper = document.createElement('div')
    const a = document.createElement('span')
    a.textContent = 'SM'
    const b = document.createElement('span')
    b.textContent = 'Sara mentioned you'
    const c = document.createElement('span')
    c.textContent = 'in Design Review #14'
    const d = document.createElement('span')
    d.textContent = '2m'
    wrapper.append(a, b, c, d)
    document.body.appendChild(wrapper)

    const locator = getElementLocator(wrapper)
    expect(locator.textPreview).toBe('SM Sara mentioned you in Design Review #14 2m')
    wrapper.remove()
  })

  it('keeps punctuation attached when text is split across nodes', () => {
    const wrapper = document.createElement('div')
    const a = document.createElement('span')
    a.textContent = 'Hello'
    const b = document.createElement('span')
    b.textContent = ', world'
    wrapper.append(a, b)
    document.body.appendChild(wrapper)

    const locator = getElementLocator(wrapper)
    expect(locator.textPreview).toBe('Hello, world')
    wrapper.remove()
  })

  it('captures component frame metadata from React fiber', () => {
    const target = document.createElement('button')
    document.body.appendChild(target)

    const Button = () => null
    ;(Button as { displayName?: string }).displayName = 'Button'

    const previousDevtools = window.__DIRECT_EDIT_DEVTOOLS__
    window.__DIRECT_EDIT_DEVTOOLS__ = {
      getFiberForElement: () => ({
        type: Button,
        memoizedProps: {
          variant: 'primary',
          size: 'lg',
        },
        _debugSource: {
          fileName: 'src/components/Button.tsx',
          lineNumber: 12,
          columnNumber: 3,
        },
        _debugOwner: null,
        return: null,
      }),
    }

    try {
      const locator = getElementLocator(target)
      const frame = locator.reactStack[0]
      expect(frame?.name).toBe('Button')
      expect(frame?.file).toBe('src/components/Button.tsx')
      expect(frame?.line).toBe(12)
      expect(frame?.column).toBe(3)
      expect('props' in ((frame as unknown) as Record<string, unknown>)).toBe(false)
    } finally {
      window.__DIRECT_EDIT_DEVTOOLS__ = previousDevtools
      target.remove()
    }
  })

  it('uses React debug owner stack when babel source metadata is unavailable', () => {
    const target = document.createElement('button')
    document.body.appendChild(target)

    const Button = () => null
    ;(Button as { displayName?: string }).displayName = 'Button'

    const previousDevtools = window.__DIRECT_EDIT_DEVTOOLS__
    window.__DIRECT_EDIT_DEVTOOLS__ = {
      getFiberForElement: () => ({
        type: 'button',
        _debugOwner: {
          type: Button,
          _debugStack: {
            stack: `Error: react-stack-top-frame
    at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/main.js:1:1)
    at Button (webpack-internal:///(app-pages-browser)/./src/components/Button.tsx:33:11)
    at react-stack-bottom-frame (http://localhost:3000/_next/static/chunks/main.js:2:2)`,
          },
          _debugOwner: null,
          return: null,
        },
        return: null,
      }),
    }

    try {
      const locator = getElementLocator(target)
      const frame = locator.reactStack[0]
      expect(frame?.name).toBe('Button')
      expect(frame?.file).toBe('/src/components/Button.tsx')
      expect(frame?.line).toBe(33)
      expect(frame?.column).toBe(11)

      expect(locator.domSource?.file).toBe('/src/components/Button.tsx')
      expect(locator.domSource?.line).toBe(33)
      expect(locator.domSource?.column).toBe(11)
    } finally {
      window.__DIRECT_EDIT_DEVTOOLS__ = previousDevtools
      target.remove()
    }
  })

  it('formats owner-stack source paths from Next.js debug stacks in context output', () => {
    const target = document.createElement('button')
    target.textContent = 'Click me'
    document.body.appendChild(target)

    const Button = () => null
    ;(Button as { displayName?: string }).displayName = 'Button'

    const previousDevtools = window.__DIRECT_EDIT_DEVTOOLS__
    window.__DIRECT_EDIT_DEVTOOLS__ = {
      getFiberForElement: () => ({
        type: Button,
        _debugStack: {
          stack: `Error: react-stack-top-frame
    at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/main.js:1:1)
    at Button (webpack-internal:///(app-pages-browser)/./src/components/Button.tsx:44:7)
    at react-stack-bottom-frame (http://localhost:3000/_next/static/chunks/main.js:2:2)`,
        },
        _debugOwner: null,
        return: null,
      }),
    }

    try {
      const locator = getElementLocator(target)
      const output = buildElementContext(locator)
      expect(output).toContain('in /[project]/src/components/Button.tsx:44:7')
    } finally {
      window.__DIRECT_EDIT_DEVTOOLS__ = previousDevtools
      target.remove()
    }
  })

  it('parses Firefox/Safari style owner stacks', () => {
    const target = document.createElement('button')
    document.body.appendChild(target)

    const Button = () => null
    ;(Button as { displayName?: string }).displayName = 'Button'

    const previousDevtools = window.__DIRECT_EDIT_DEVTOOLS__
    window.__DIRECT_EDIT_DEVTOOLS__ = {
      getFiberForElement: () => ({
        type: Button,
        _debugStack: {
          stack: `Button@webpack-internal:///(app-pages-browser)/./src/components/Button.tsx:28:9
react-stack-bottom-frame@http://localhost:3000/_next/static/chunks/main.js:2:2`,
        },
        _debugOwner: null,
        return: null,
      }),
    }

    try {
      const locator = getElementLocator(target)
      const frame = locator.reactStack[0]
      expect(frame?.name).toBe('Button')
      expect(frame?.file).toBe('/src/components/Button.tsx')
      expect(frame?.line).toBe(28)
      expect(frame?.column).toBe(9)
    } finally {
      window.__DIRECT_EDIT_DEVTOOLS__ = previousDevtools
      target.remove()
    }
  })

  it('does not lock on bundle-only frames and falls back to owner fiber source', () => {
    const target = document.createElement('button')
    document.body.appendChild(target)

    const Button = () => null
    ;(Button as { displayName?: string }).displayName = 'Button'

    const previousDevtools = window.__DIRECT_EDIT_DEVTOOLS__
    window.__DIRECT_EDIT_DEVTOOLS__ = {
      getFiberForElement: () => ({
        type: 'button',
        _debugStack: {
          stack: `Error: react-stack-top-frame
    at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/main.js:1:1)
    at button (http://localhost:3000/_next/static/chunks/main.js:100:1)
    at react-stack-bottom-frame (http://localhost:3000/_next/static/chunks/main.js:2:2)`,
        },
        _debugOwner: {
          type: Button,
          _debugStack: {
            stack: `Error: react-stack-top-frame
    at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/main.js:1:1)
    at Button (webpack-internal:///(app-pages-browser)/./src/components/Button.tsx:61:13)
    at react-stack-bottom-frame (http://localhost:3000/_next/static/chunks/main.js:2:2)`,
          },
          _debugOwner: null,
          return: null,
        },
        return: null,
      }),
    }

    try {
      const locator = getElementLocator(target)
      expect(locator.domSource?.file).toBe('/src/components/Button.tsx')
      expect(locator.domSource?.line).toBe(61)
      expect(locator.domSource?.column).toBe(13)
    } finally {
      window.__DIRECT_EDIT_DEVTOOLS__ = previousDevtools
      target.remove()
    }
  })

  it('enriches "(at Server)" owner stack frames using RSC frame matches', () => {
    const target = document.createElement('button')
    document.body.appendChild(target)

    const TodoItem = () => null
    ;(TodoItem as { displayName?: string }).displayName = 'TodoItem'

    const previousDevtools = window.__DIRECT_EDIT_DEVTOOLS__
    window.__DIRECT_EDIT_DEVTOOLS__ = {
      getFiberForElement: () => ({
        type: TodoItem,
        _debugStack: {
          stack: `Error: react-stack-top-frame
    at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/main.js:1:1)
    in TodoItem (at Server)
    at react-stack-bottom-frame (http://localhost:3000/_next/static/chunks/main.js:2:2)`,
        },
        _debugOwner: {
          type: TodoItem,
          _debugStack: {
            stack: `Error: react-stack-top-frame
    at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/main.js:1:1)
    at TodoItem (rsc://React/Server/file:///Users/rezailmi/project/app/todo-item.tsx:14:6)
    at react-stack-bottom-frame (http://localhost:3000/_next/static/chunks/main.js:2:2)`,
          },
          _debugOwner: null,
          return: null,
        },
        return: null,
      }),
    }

    try {
      const locator = getElementLocator(target)
      expect(locator.domSource?.file).toBe('/Users/rezailmi/project/app/todo-item.tsx')
      expect(locator.domSource?.line).toBe(14)
      expect(locator.domSource?.column).toBe(6)

      const output = buildElementContext(locator)
      expect(output).toContain('in /[project]/app/todo-item.tsx:14:6')
    } finally {
      window.__DIRECT_EDIT_DEVTOOLS__ = previousDevtools
      target.remove()
    }
  })

  it('normalizes anonymous RSC debug stack file paths', () => {
    const target = document.createElement('button')
    target.textContent = 'Click me'
    document.body.appendChild(target)

    const previousDevtools = window.__DIRECT_EDIT_DEVTOOLS__
    window.__DIRECT_EDIT_DEVTOOLS__ = {
      getFiberForElement: () => ({
        type: 'button',
        _debugStack: {
          stack: `Error: react-stack-top-frame
    at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/main.js:1:1)
    at rsc://React/Server/file:///Users/rezailmi/project/app/todo-item.tsx:14:6
    at react-stack-bottom-frame (http://localhost:3000/_next/static/chunks/main.js:2:2)`,
        },
        _debugOwner: null,
        return: null,
      }),
    }

    try {
      const locator = getElementLocator(target)
      expect(locator.domSource?.file).toBe('/Users/rezailmi/project/app/todo-item.tsx')
      expect(locator.domSource?.line).toBe(14)
      expect(locator.domSource?.column).toBe(6)

      const output = buildElementContext(locator)
      expect(output).toContain('in /[project]/app/todo-item.tsx:14:6')
    } finally {
      window.__DIRECT_EDIT_DEVTOOLS__ = previousDevtools
      target.remove()
    }
  })
})

describe('computeIntendedIndex', () => {
  function makeChild(top: number, height: number): HTMLElement {
    const el = document.createElement('div')
    el.style.display = 'block'
    el.style.position = 'static'
    el.getBoundingClientRect = () => ({
      top, left: 0, width: 100, height, bottom: top + height, right: 100,
      x: 0, y: top, toJSON() {},
    })
    return el
  }

  it('returns index past siblings when dragged below them', () => {
    const parent = document.createElement('div')
    const child1 = makeChild(0, 50)
    const child2 = makeChild(50, 50)
    const dragged = makeChild(120, 50) // center at 145, past both siblings
    parent.appendChild(child1)
    parent.appendChild(dragged)
    parent.appendChild(child2)

    // Mock getComputedStyle for children
    const origGetComputedStyle = window.getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const style = origGetComputedStyle(el)
      return style
    })

    const result = computeIntendedIndex(parent, dragged)
    expect(result.index).toBe(2)
    expect(result.siblingBefore).toBe(child2)
    expect(result.siblingAfter).toBe(null)

    vi.restoreAllMocks()
  })

  it('returns original index when element does not cross any midpoint', () => {
    const parent = document.createElement('div')
    const child1 = makeChild(0, 50)
    const dragged = makeChild(55, 50) // center at 80, between child1(25) and child2(125)
    const child2 = makeChild(100, 50)
    parent.appendChild(child1)
    parent.appendChild(dragged)
    parent.appendChild(child2)

    const result = computeIntendedIndex(parent, dragged)
    expect(result.index).toBe(1)
    expect(result.siblingBefore).toBe(child1)
    expect(result.siblingAfter).toBe(child2)
  })

  it('returns index 0 with no siblings', () => {
    const parent = document.createElement('div')
    const dragged = makeChild(0, 50)
    parent.appendChild(dragged)

    const result = computeIntendedIndex(parent, dragged)
    expect(result.index).toBe(0)
    expect(result.siblingBefore).toBe(null)
    expect(result.siblingAfter).toBe(null)
  })

  it('skips position: absolute children', () => {
    const parent = document.createElement('div')
    const absChild = makeChild(0, 50)
    absChild.style.position = 'absolute'
    const normalChild = makeChild(50, 50)
    const dragged = makeChild(120, 50) // past normalChild
    parent.appendChild(absChild)
    parent.appendChild(normalChild)
    parent.appendChild(dragged)

    const result = computeIntendedIndex(parent, dragged)
    expect(result.index).toBe(1)
    expect(result.siblingBefore).toBe(normalChild)
    expect(result.siblingAfter).toBe(null)
  })
})

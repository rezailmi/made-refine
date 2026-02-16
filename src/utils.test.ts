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
  buildElementContext,
  buildEditExport,
  buildCommentExport,
  buildSessionExport,
  getElementLocator,
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
      },
    }

    const output = buildSessionExport([edit], [])
    expect(output).toContain('moved:')
    expect(output).toContain('summary: in <div>, from before <div> (first) to after <div> (last)')
    expect(output).toContain('from_parent_selector: main > div:nth-of-type(1)')
    expect(output).toContain('from_before_selector: (none)')
    expect(output).toContain('from_after_selector: main > div:nth-of-type(1) > div:nth-of-type(1)')
    expect(output).toContain('to_parent_selector: main > div:nth-of-type(1)')
    expect(output).toContain('to_before_selector: main > div:nth-of-type(1) > div:nth-of-type(3)')
    expect(output).toContain('to_after_selector: (none)')
    expect(output).toContain('from_parent_source: src/App.tsx:40:3')
    expect(output).toContain('from_before_source: (none)')
    expect(output).toContain('from_after_source: src/App.tsx:42:9')
    expect(output).toContain('to_parent_source: src/App.tsx:40:3')
    expect(output).toContain('to_before_source: src/App.tsx:47:9')
    expect(output).toContain('to_after_source: (none)')
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
})

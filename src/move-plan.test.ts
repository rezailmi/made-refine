import { describe, expect, it } from 'vitest'
import {
  buildMovePlan,
  buildMovePlanContext,
  getMoveIntentForEdit,
  buildSessionExport,
  getExportContentProfile,
} from './utils'
import type { SessionEdit } from './types'

function mockRect(
  element: HTMLElement,
  rect: { left: number; top: number; width: number; height: number }
) {
  element.getBoundingClientRect = () => ({
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    toJSON: () => ({}),
  }) as DOMRect
}

function makeMoveEdit(overrides: Partial<NonNullable<SessionEdit['move']>> = {}): SessionEdit {
  const element = document.createElement('button')
  element.textContent = 'Go'
  document.body.appendChild(element)

  return {
    element,
    locator: {
      tagName: 'button',
      id: null,
      classList: [],
      domSelector: '#root > div > button',
      targetHtml: '<button>Go</button>',
      textPreview: 'Go',
      reactStack: [{ name: 'App' }],
      domContextHtml: '<div><button>Go</button></div>',
      domSource: { file: 'App.tsx', line: 10, column: 9 },
    },
    originalStyles: {},
    pendingStyles: {},
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
      fromParentLayout: 'block',
      toParentLayout: 'block',
      mode: 'free',
      ...overrides,
    },
  }
}

describe('move plan', () => {
  it('classifies existing flex reorder as existing_layout_move', () => {
    const edit = makeMoveEdit({
      mode: 'reorder',
      fromParentLayout: 'flex',
      toParentLayout: 'flex',
      fromFlexDirection: 'row',
      toFlexDirection: 'row',
      fromIndex: 1,
      toIndex: 2,
      toSiblingBefore: 'p',
      toSiblingAfter: null,
    })

    const plan = buildMovePlan([edit])
    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0].classification).toBe('existing_layout_move')
    edit.element.remove()
  })

  it('classifies free move with visual delta as layout_refactor with prescription', () => {
    const edit = makeMoveEdit({
      mode: 'free',
      visualDelta: { x: 420, y: -30 },
    })

    const plan = buildMovePlan([edit])
    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0].classification).toBe('layout_refactor')
    expect(plan.operations[0].layoutPrescription?.recommendedSystem).toBeDefined()
    edit.element.remove()
  })

  it('prefers flex row with wrapper guidance for header + right CTA intent', () => {
    const container = document.createElement('div')
    const heading = document.createElement('h1')
    const button = document.createElement('button')
    const paragraph = document.createElement('p')
    const panel = document.createElement('div')
    heading.textContent = 'handmade playground'
    button.textContent = 'Go to canvas playground page'
    paragraph.textContent = 'Press ⌘. to toggle edit mode.'
    panel.textContent = 'Dashboard'
    container.append(heading, button, paragraph, panel)
    document.body.appendChild(container)

    mockRect(container, { left: 60, top: 120, width: 1280, height: 560 })
    mockRect(heading, { left: 120, top: 180, width: 520, height: 64 })
    mockRect(button, { left: 980, top: 186, width: 320, height: 56 })
    mockRect(paragraph, { left: 120, top: 268, width: 640, height: 40 })
    mockRect(panel, { left: 120, top: 360, width: 1160, height: 240 })

    const edit = makeMoveEdit({
      mode: 'position',
      visualDelta: { x: 746, y: -11 },
    })
    edit.element.remove()
    edit.element = button
    edit.locator = {
      ...edit.locator,
      domSelector: '#root > div > button',
      domSource: { file: 'App.tsx', line: 161, column: 9 },
    }

    const plan = buildMovePlan([edit])
    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0].classification).toBe('layout_refactor')
    expect(plan.operations[0].layoutPrescription?.recommendedSystem).toBe('flex')
    expect(plan.operations[0].layoutPrescription?.styleSteps.join('\n')).toContain('justify-content: space-between')
    expect(plan.operations[0].layoutPrescription?.refactorSteps.join('\n')).toContain('content wrapper')

    container.remove()
  })

  it('keeps grid recommendation for true 2D matrix layouts', () => {
    const container = document.createElement('div')
    const a = document.createElement('div')
    const b = document.createElement('div')
    const c = document.createElement('div')
    const d = document.createElement('div')
    container.append(a, b, c, d)
    document.body.appendChild(container)

    mockRect(a, { left: 100, top: 120, width: 180, height: 80 })
    mockRect(b, { left: 320, top: 120, width: 180, height: 80 })
    mockRect(c, { left: 100, top: 240, width: 180, height: 80 })
    mockRect(d, { left: 320, top: 240, width: 180, height: 80 })

    const edit = makeMoveEdit({
      mode: 'position',
      visualDelta: { x: 80, y: 60 },
    })
    edit.element.remove()
    edit.element = d
    edit.locator = {
      ...edit.locator,
      domSelector: '#root > div > div:nth-of-type(4)',
    }

    const plan = buildMovePlan([edit])
    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0].layoutPrescription?.recommendedSystem).toBe('grid')

    container.remove()
  })

  it('prunes noop moves', () => {
    const edit = makeMoveEdit({
      mode: 'reorder',
      fromIndex: 1,
      toIndex: 1,
      visualDelta: { x: 0, y: 0 },
    })

    const plan = buildMovePlan([edit])
    expect(plan.operations).toHaveLength(0)
    edit.element.remove()
  })

  it('keeps operation ids aligned between move plan and per-edit intent', () => {
    const edit = makeMoveEdit({
      mode: 'free',
      visualDelta: { x: 100, y: 10 },
    })

    const context = buildMovePlanContext([edit])
    const intent = getMoveIntentForEdit(edit, context)

    expect(intent?.operationId).toBe(context.movePlan?.operations[0].operationId)
    edit.element.remove()
  })

  it('builds move export format without legacy move fields', () => {
    const edit = makeMoveEdit({
      mode: 'free',
      visualDelta: { x: 140, y: -22 },
    })

    const context = buildMovePlanContext([edit])
    const markdown = buildSessionExport([edit], [], { movePlanContext: context })
    expect(markdown).toContain('=== LAYOUT MOVE PLAN ===')
    expect(markdown).toContain('id: op-1')
    expect(markdown).toContain('type: layout_refactor')
    expect(markdown).not.toContain('from_parent_display:')
    expect(markdown).not.toContain('layout_intent:')
    edit.element.remove()
  })

  it('export profile derives hasMoves from plan operations', () => {
    const edit = makeMoveEdit({
      mode: 'reorder',
      fromIndex: 1,
      toIndex: 1,
      visualDelta: { x: 0, y: 0 },
    })

    const context = buildMovePlanContext([edit])
    const profile = getExportContentProfile([edit], [], context)
    expect(profile.hasMoves).toBe(false)
    edit.element.remove()
  })
})

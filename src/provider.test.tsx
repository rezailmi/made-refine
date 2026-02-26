import * as React from 'react'
import { act, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DirectEditProvider, useDirectEdit, useDirectEditActions, useDirectEditState } from './provider'
import { DirectEditPanel } from './panel'
import { DirectEditToolbar } from './toolbar'
import { Rulers } from './rulers-overlay'

const { sendEditToAgentMock, sendCommentToAgentMock } = vi.hoisted(() => ({
  sendEditToAgentMock: vi.fn<(...args: unknown[]) => Promise<{ ok: boolean; id: string }>>().mockResolvedValue({ ok: true, id: 'edit-1' }),
  sendCommentToAgentMock: vi.fn<(...args: unknown[]) => Promise<{ ok: boolean; id: string }>>().mockResolvedValue({ ok: true, id: 'comment-1' }),
}))

vi.mock('./mcp-client', () => ({
  sendEditToAgent: sendEditToAgentMock,
  sendCommentToAgent: sendCommentToAgentMock,
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DirectEditProvider>{children}</DirectEditProvider>
)

const fullUiWrapper = ({ children }: { children: React.ReactNode }) => (
  <DirectEditProvider>
    <DirectEditPanel />
    <DirectEditToolbar />
    <Rulers />
    {children}
  </DirectEditProvider>
)

const toolbarWrapper = ({ children }: { children: React.ReactNode }) => (
  <DirectEditProvider>
    <DirectEditToolbar />
    {children}
  </DirectEditProvider>
)

const panelWrapper = ({ children }: { children: React.ReactNode }) => (
  <DirectEditProvider>
    <DirectEditPanel />
    {children}
  </DirectEditProvider>
)

const documentPropertyRestores: Array<() => void> = []

function cssValue(numericValue: number) {
  return {
    numericValue,
    unit: 'px' as const,
    raw: `${numericValue}px`,
  }
}

function createTarget(id: string, styleText = ''): HTMLElement {
  const el = document.createElement('div')
  el.id = id
  el.textContent = `target-${id}`
  if (styleText) el.style.cssText = styleText
  document.body.appendChild(el)
  return el
}

function mockClipboard() {
  const writeText = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return writeText
}

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })))
}

function resetStorage() {
  const keys = [
    'direct-edit-theme',
    'direct-edit-guidelines',
    'direct-edit-rulers-visible',
    'direct-edit-toolbar-dock',
    'direct-edit-panel-position',
    'direct-edit-border-style-control',
  ]
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore storage access issues in test envs
    }
  }
}

function clickOverlay(overlay: HTMLElement, clientX: number, clientY: number) {
  overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX, clientY }))
}

function mockElementFromPoint(returnElement: HTMLElement) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')
  const elementFromPoint = vi.fn<(...args: unknown[]) => HTMLElement | null>().mockReturnValue(returnElement)
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    writable: true,
    value: elementFromPoint,
  })
  documentPropertyRestores.push(() => {
    if (originalDescriptor) {
      Object.defineProperty(document, 'elementFromPoint', originalDescriptor)
    } else {
      delete (document as unknown as Record<string, unknown>).elementFromPoint
    }
  })
  return elementFromPoint
}

async function findOverlayElement(): Promise<HTMLElement> {
  const host = await waitFor(() => {
    const node = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
    expect(node).not.toBeNull()
    return node as HTMLElement
  })

  return waitFor(() => {
    const overlay = host.shadowRoot?.querySelector('[data-direct-edit="overlay"]') as HTMLElement | null
    expect(overlay).not.toBeNull()
    return overlay as HTMLElement
  })
}

async function findToolbarButtonByIcon(shadowRoot: ShadowRoot, iconClass: string): Promise<HTMLButtonElement> {
  return waitFor(() => {
    const icon = shadowRoot.querySelector(`svg.${iconClass}`) as SVGElement | null
    const button = icon?.closest('button') as HTMLButtonElement | null
    expect(button).not.toBeNull()
    return button as HTMLButtonElement
  })
}

describe('DirectEditProvider', () => {
  beforeEach(() => {
    resetStorage()
    document.documentElement.removeAttribute('data-direct-edit-disable-styles')
  })

  afterEach(() => {
    while (documentPropertyRestores.length > 0) {
      const restore = documentPropertyRestores.pop()
      restore?.()
    }
    sendEditToAgentMock.mockClear()
    sendCommentToAgentMock.mockClear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-direct-edit-disable-styles')
    document.body.innerHTML = ''
    // Clean up hosts appended to documentElement (outside body)
    document.querySelectorAll('[data-direct-edit-host]').forEach(el => el.remove())
    resetStorage()
  })

  it('selects an element, updates styles, supports undo, and resets to original', async () => {
    mockClipboard()
    const target = createTarget('card', 'padding-top: 8px; margin-left: 4px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedElement).toBe(target)
      expect(result.current.elementInfo?.id).toBe('card')
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(24))
    })

    expect(target.style.getPropertyValue('padding-top')).toBe('24px')
    expect(result.current.pendingStyles['padding-top']).toBe('24px')

    act(() => {
      result.current.undo()
    })

    expect(target.style.getPropertyValue('padding-top')).toBe('8px')
    expect(result.current.pendingStyles['padding-top']).toBe('8px')

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(16))
    })

    expect(target.style.getPropertyValue('padding-top')).toBe('16px')

    act(() => {
      result.current.resetToOriginal()
    })

    expect(target.style.getPropertyValue('padding-top')).toBe('8px')
    expect(Object.keys(result.current.pendingStyles)).toHaveLength(0)
  })

  it('exposes split hooks and keeps actions context stable across state updates', async () => {
    mockClipboard()
    const target = createTarget('split-hooks-target', 'padding-top: 2px;')

    const { result } = renderHook(() => ({
      state: useDirectEditState(),
      actions: useDirectEditActions(),
    }), { wrapper })

    const initialActions = result.current.actions

    act(() => {
      result.current.actions.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.state.selectedElement).toBe(target)
    })
    expect(result.current.actions).toBe(initialActions)

    act(() => {
      result.current.actions.updateSpacingProperty('paddingTop', cssValue(18))
    })

    await waitFor(() => {
      expect(result.current.state.pendingStyles['padding-top']).toBe('18px')
    })
    expect(result.current.actions).toBe(initialActions)
  })

  it('adds box shadow, exports it, supports undo, and resets to original', async () => {
    const clipboardWrite = mockClipboard()
    const target = createTarget('shadow-card')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    clipboardWrite.mockClear()

    const shadowValue = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)'
    act(() => {
      result.current.updateRawCSS({ 'box-shadow': shadowValue })
    })

    expect(target.style.getPropertyValue('box-shadow')).toBe(shadowValue)
    expect(result.current.pendingStyles['box-shadow']).toBe(shadowValue)

    const copied = await result.current.exportEdits()
    expect(copied).toBe(true)
    expect(String(clipboardWrite.mock.calls[0][0])).toContain(`box-shadow: ${shadowValue}`)

    act(() => {
      result.current.undo()
    })

    expect(target.style.getPropertyValue('box-shadow')).toBe('')
    expect(result.current.pendingStyles['box-shadow']).toBeUndefined()

    act(() => {
      result.current.updateRawCSS({ 'box-shadow': 'none' })
    })

    expect(target.style.getPropertyValue('box-shadow')).toBe('none')
    expect(result.current.pendingStyles['box-shadow']).toBe('none')

    act(() => {
      result.current.resetToOriginal()
    })

    expect(target.style.getPropertyValue('box-shadow')).toBe('')
  })

  it('retains only the latest 500 undo entries', async () => {
    const target = createTarget('undo-limit-target', 'padding-top: 0px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      for (let i = 1; i <= 501; i += 1) {
        result.current.updateSpacingProperty('paddingTop', cssValue(i))
      }
    })

    expect(target.style.getPropertyValue('padding-top')).toBe('501px')

    act(() => {
      for (let i = 0; i < 500; i += 1) {
        result.current.undo()
      }
    })

    // The oldest entry (0px -> 1px) is dropped once the cap is exceeded.
    expect(target.style.getPropertyValue('padding-top')).toBe('1px')
    expect(result.current.pendingStyles['padding-top']).toBe('1px')

    act(() => {
      result.current.undo()
    })

    // No-op because there is no remaining undo entry.
    expect(target.style.getPropertyValue('padding-top')).toBe('1px')
    expect(result.current.pendingStyles['padding-top']).toBe('1px')
  })

  it('handles keyboard toggles and applies persisted theme to the shadow host', async () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', ctrlKey: true }))
    })
    expect(result.current.editModeActive).toBe(true)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(result.current.editModeActive).toBe(false)

    const host = await waitFor(() => {
      const node = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    act(() => {
      result.current.setTheme('dark')
    })

    await waitFor(() => {
      expect(host.getAttribute('data-theme')).toBe('dark')
      expect(localStorage.getItem('direct-edit-theme')).toBe('dark')
    })
  })

  it('applies dark and light themes across toolbar, panel, and rulers', async () => {
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    stubMatchMedia()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    mockClipboard()
    const target = createTarget('theme-target', 'padding-top: 8px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper: fullUiWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(target)
    })

    const host = await waitFor(() => {
      const node = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    const shadowRoot = host.shadowRoot
    expect(shadowRoot).not.toBeNull()

    const toolbar = await waitFor(() => {
      const node = shadowRoot?.querySelector('[data-direct-edit="toolbar"]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })
    const panel = await waitFor(() => {
      const node = shadowRoot?.querySelector('[data-direct-edit="panel"]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })
    const rulerHorizontal = await waitFor(() => {
      const node = shadowRoot?.querySelector('[data-direct-edit="ruler-horizontal"]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })
    const rulerVertical = await waitFor(() => {
      const node = shadowRoot?.querySelector('[data-direct-edit="ruler-vertical"]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })
    const rulerCorner = await waitFor(() => {
      const node = shadowRoot?.querySelector('[data-direct-edit="ruler-corner"]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    expect(toolbar.className).toContain('bg-background')
    expect(panel.className).toContain('outline-foreground/10')
    expect(panel.className).toContain('shadow-lg')
    expect(rulerHorizontal.style.background).toBe('var(--color-background)')
    expect(rulerVertical.style.background).toBe('var(--color-background)')
    expect(rulerCorner.style.background).toBe('var(--color-background)')
    expect(rulerHorizontal.style.color).toBe('var(--color-muted-foreground)')
    expect(rulerVertical.style.color).toBe('var(--color-muted-foreground)')

    const panelHeader = panel.firstElementChild as HTMLElement | null
    expect(panelHeader).not.toBeNull()
    expect((panelHeader as HTMLElement).className).toContain('bg-background')
    expect((panelHeader as HTMLElement).className).toContain('border-border/50')

    act(() => {
      result.current.setTheme('dark')
    })
    await waitFor(() => {
      expect(host.getAttribute('data-theme')).toBe('dark')
      expect(localStorage.getItem('direct-edit-theme')).toBe('dark')
    })

    act(() => {
      result.current.setTheme('light')
    })
    await waitFor(() => {
      expect(host.getAttribute('data-theme')).toBe('light')
      expect(localStorage.getItem('direct-edit-theme')).toBe('light')
    })
  })

  it('coordinates toolbar popovers and closes them on outside click', async () => {
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    stubMatchMedia()

    const { result } = renderHook(() => useDirectEdit(), { wrapper: toolbarWrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    const host = await waitFor(() => {
      const node = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    const shadowRoot = host.shadowRoot
    expect(shadowRoot).not.toBeNull()
    const root = shadowRoot as ShadowRoot

    const editsTrigger = await findToolbarButtonByIcon(root, 'lucide-copy')
    act(() => {
      fireEvent.click(editsTrigger)
    })
    await waitFor(() => {
      expect(root.textContent).toContain('Copy to AI agents')
    })

    const settingsTrigger = await findToolbarButtonByIcon(root, 'lucide-ellipsis-vertical')
    act(() => {
      fireEvent.click(settingsTrigger)
    })
    await waitFor(() => {
      expect(root.textContent).toContain('Theme')
      expect(root.textContent).toContain('Keyboard shortcuts')
      expect(root.textContent).not.toContain('Copy to AI agents')
    })

    const keyboardShortcutsTrigger = await waitFor(() => {
      const items = Array.from(root.querySelectorAll('[role="menuitem"]')) as HTMLElement[]
      const item = items.find((el) => el.textContent?.trim() === 'Keyboard shortcuts')
      expect(item).not.toBeUndefined()
      return item as HTMLElement
    })
    act(() => {
      fireEvent.click(keyboardShortcutsTrigger)
    })
    await waitFor(() => {
      expect(root.textContent).toContain('Toggle design mode')
    })

    const themeTrigger = await waitFor(() => {
      const items = Array.from(root.querySelectorAll('[role="menuitem"]')) as HTMLElement[]
      const item = items.find((el) => el.textContent?.trim() === 'Theme')
      expect(item).not.toBeUndefined()
      return item as HTMLElement
    })
    act(() => {
      fireEvent.click(themeTrigger)
    })
    await waitFor(() => {
      expect(root.textContent).toContain('Light')
      expect(root.textContent).toContain('Dark')
      expect(root.textContent).toContain('System')
    })

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    })

    act(() => {
      fireEvent.pointerDown(document.documentElement)
    })
    await waitFor(() => {
      expect(root.textContent).not.toContain('Theme')
    })
  })

  it('clamps persisted panel position to the viewport', async () => {
    stubMatchMedia()
    localStorage.setItem('direct-edit-panel-position', JSON.stringify({ x: -320, y: -180 }))
    const target = createTarget('panel-clamp-target', 'padding-top: 8px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.selectElement(target)
    })

    const host = await waitFor(() => {
      const node = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    const panel = await waitFor(() => {
      const node = host.shadowRoot?.querySelector('[data-direct-edit="panel"]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    expect(panel.style.left).toBe('8px')
    expect(panel.style.top).toBe('8px')
  })

  it('re-clamps panel position when viewport shrinks below panel size', async () => {
    stubMatchMedia()
    localStorage.setItem('direct-edit-panel-position', JSON.stringify({ x: 500, y: 300 }))
    const target = createTarget('panel-resize-target', 'padding-top: 8px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.selectElement(target)
    })

    const host = await waitFor(() => {
      const node = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    const panel = await waitFor(() => {
      const node = host.shadowRoot?.querySelector('[data-direct-edit="panel"]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    expect(panel.style.left).toBe('500px')
    expect(panel.style.top).toBe('340px')

    const originalWidth = window.innerWidth
    const originalHeight = window.innerHeight

    try {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 180,
        writable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 160,
        writable: true,
      })

      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      await waitFor(() => {
        expect(panel.style.left).toBe('0px')
        expect(panel.style.top).toBe('0px')
      })
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalWidth,
        writable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalHeight,
        writable: true,
      })
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
    }
  })

  it('supports code-based period toggle and ignores shift/alt variants', () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', code: 'Period', ctrlKey: true }))
    })
    expect(result.current.editModeActive).toBe(true)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(result.current.editModeActive).toBe(false)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '>', code: 'Period', ctrlKey: true, shiftKey: true }))
    })
    expect(result.current.editModeActive).toBe(false)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', ctrlKey: true, altKey: true }))
    })
    expect(result.current.editModeActive).toBe(false)
  })

  it('exports and sends edits for a selected element', async () => {
    const clipboardWrite = mockClipboard()
    const target = createTarget('button', 'padding-top: 4px;')
    target.setAttribute('data-direct-edit-source', 'src/App.tsx:10:2')

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    clipboardWrite.mockClear()

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(12))
    })

    clipboardWrite.mockClear()
    const copied = await result.current.exportEdits()
    expect(copied).toBe(true)
    expect(clipboardWrite).toHaveBeenCalledTimes(1)
    expect(String(clipboardWrite.mock.calls[0][0])).toContain('padding-top: 12px')

    const sent = await result.current.sendEditToAgent()
    expect(sent).toBe(true)
    expect(sendEditToAgentMock).toHaveBeenCalledTimes(1)

    const payload = sendEditToAgentMock.mock.calls[0][0] as {
      changes: Array<{ cssProperty: string; cssValue: string; tailwindClass: string }>
      source: { file?: string } | null
    }
    expect(payload.source?.file).toBe('src/App.tsx')
    expect(payload.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cssProperty: 'padding-top',
          cssValue: '12px',
        }),
      ]),
    )
  })

  it('sends collapsed spacing shorthand changes to agent', async () => {
    mockClipboard()
    const target = createTarget('spacing-shorthand-target')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(16))
      result.current.updateSpacingProperty('paddingRight', cssValue(16))
      result.current.updateSpacingProperty('paddingBottom', cssValue(16))
      result.current.updateSpacingProperty('paddingLeft', cssValue(16))
    })

    const sent = await result.current.sendEditToAgent()
    expect(sent).toBe(true)
    expect(sendEditToAgentMock).toHaveBeenCalledTimes(1)

    const payload = sendEditToAgentMock.mock.calls[0][0] as {
      changes: Array<{ cssProperty: string; cssValue: string; tailwindClass: string }>
    }
    const cssProperties = payload.changes.map((change) => change.cssProperty)

    expect(payload.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cssProperty: 'padding',
          cssValue: '16px',
          tailwindClass: 'p-4',
        }),
      ]),
    )
    expect(cssProperties).not.toContain('padding-top')
    expect(cssProperties).not.toContain('padding-right')
    expect(cssProperties).not.toContain('padding-bottom')
    expect(cssProperties).not.toContain('padding-left')
  })

  it('sends all session items to agents', async () => {
    mockClipboard()
    const editTarget = createTarget('bulk-send-edit-target')
    const commentTarget = createTarget('bulk-send-comment-target', 'padding-top: 8px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(editTarget)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(editTarget)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(18))
      result.current.addComment(commentTarget, { x: 18, y: 28 })
    })

    const commentId = result.current.comments[0]?.id
    expect(commentId).toBeDefined()

    act(() => {
      result.current.updateCommentText(commentId!, 'Move this block below the hero')
    })

    sendEditToAgentMock.mockClear()
    sendCommentToAgentMock.mockClear()

    const sent = await result.current.sendAllSessionItemsToAgent()
    expect(sent).toBe(true)
    expect(sendEditToAgentMock).toHaveBeenCalledTimes(1)
    expect(sendCommentToAgentMock).toHaveBeenCalledTimes(1)
  })

  it('supports comments lifecycle, clipboard export, and agent send', async () => {
    const clipboardWrite = mockClipboard()
    const target = createTarget('comment-target', 'padding-top: 8px;')
    target.setAttribute('data-direct-edit-source', 'src/App.tsx:22:4')

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.addComment(target, { x: 12, y: 20 })
    })

    expect(result.current.comments).toHaveLength(1)
    const commentId = result.current.comments[0].id

    act(() => {
      result.current.updateCommentText(commentId, 'Need more visual hierarchy')
      result.current.addCommentReply(commentId, 'Will update spacing and contrast.')
    })

    expect(result.current.comments[0].text).toBe('Need more visual hierarchy')
    expect(result.current.comments[0].replies).toHaveLength(1)

    const copied = await result.current.exportComment(commentId)
    expect(copied).toBe(true)
    expect(clipboardWrite).toHaveBeenCalledTimes(1)
    expect(String(clipboardWrite.mock.calls[0][0])).toContain('comment: Need more visual hierarchy')

    const sent = await result.current.sendCommentToAgent(commentId)
    expect(sent).toBe(true)
    expect(sendCommentToAgentMock).toHaveBeenCalledTimes(1)
  })

  it('clamps comment anchor position to the target bounds', () => {
    const target = createTarget('comment-anchor-clamp-target')
    target.getBoundingClientRect = () => ({
      left: 100,
      top: 80,
      width: 300,
      height: 200,
      right: 400,
      bottom: 280,
      x: 100,
      y: 80,
      toJSON: () => ({}),
    }) as DOMRect

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.addComment(target, { x: 40, y: 420 })
    })

    expect(result.current.comments).toHaveLength(1)
    expect(result.current.comments[0].relativePosition).toEqual({ x: 0, y: 1 })
  })

  it('exports move-only changes with structured move context', async () => {
    const clipboardWrite = mockClipboard()
    const originalParent = createTarget('move-parent')
    const originalBefore = createTarget('move-before')
    const moved = createTarget('move-target')
    const originalAfter = createTarget('move-after')
    const nextParent = createTarget('move-parent-next')
    const nextSibling = createTarget('move-next-sibling')

    originalParent.replaceChildren(originalBefore, moved, originalAfter)
    nextParent.replaceChildren(nextSibling)

    originalParent.setAttribute('data-direct-edit-source', 'src/App.tsx:90:5')
    originalBefore.setAttribute('data-direct-edit-source', 'src/App.tsx:91:7')
    originalAfter.setAttribute('data-direct-edit-source', 'src/App.tsx:92:7')
    nextParent.setAttribute('data-direct-edit-source', 'src/App.tsx:100:5')
    nextSibling.setAttribute('data-direct-edit-source', 'src/App.tsx:101:7')
    moved.setAttribute('data-direct-edit-source', 'src/App.tsx:96:19')
    moved.style.position = 'relative'
    nextParent.style.display = 'flex'

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(moved)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(moved)
    })

    clipboardWrite.mockClear()

    act(() => {
      nextParent.appendChild(moved)
      result.current.handleMoveComplete(moved, {
        originalParent,
        originalPreviousSibling: originalBefore,
        originalNextSibling: originalAfter,
        mode: 'free',
      })
    })

    const copied = await result.current.exportEdits()
    expect(copied).toBe(true)
    expect(clipboardWrite).toHaveBeenCalledTimes(1)

    const exported = String(clipboardWrite.mock.calls[0][0])
    expect(exported).toContain('moved:')
    expect(exported).toContain('summary:')
    expect(exported).toContain('mode: free')
    expect(exported).toContain('dragged_position: relative')
    expect(exported).toContain('from_parent_layout: block')
    expect(exported).toContain('to_parent_layout: flex')
    expect(exported).toContain('from_index: 1')
    expect(exported).toContain('to_index: 1')
    expect(exported).toContain('from_parent_selector:')
    expect(exported).toContain('to_parent_selector:')
    expect(exported).toContain('#move-parent')
    expect(exported).toContain('#move-parent-next')
    expect(exported).toContain('from_parent_source: src/App.tsx:90:5')
    expect(exported).toContain('from_before_source: src/App.tsx:91:7')
    expect(exported).toContain('from_after_source: src/App.tsx:92:7')
    expect(exported).toContain('to_parent_source: src/App.tsx:100:5')
    expect(exported).toContain('to_before_source: src/App.tsx:101:7')
    expect(exported).toContain('to_after_source: (none)')
  })

  it('refreshes state from moved target styles when move target differs from prior selection', async () => {
    mockClipboard()
    const originalParent = createTarget('move-state-parent')
    const moved = createTarget('move-state-target', 'margin-left: 7px;')
    const originalAfter = createTarget('move-state-after')
    const destinationParent = createTarget('move-state-parent-next')
    const selectedChild = createTarget('move-state-selected', 'padding-top: 12px;')

    originalParent.replaceChildren(moved, originalAfter)
    moved.appendChild(selectedChild)

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(selectedChild)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(selectedChild)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(33))
    })

    expect(result.current.pendingStyles['padding-top']).toBe('33px')

    act(() => {
      destinationParent.appendChild(moved)
      result.current.handleMoveComplete(moved, {
        originalParent,
        originalPreviousSibling: null,
        originalNextSibling: originalAfter,
        mode: 'free',
      })
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(moved)
    })

    expect(result.current.originalStyles['margin-left']).toBe('7px')
    expect(result.current.originalStyles['padding-top']).toBeUndefined()
    expect(result.current.pendingStyles).toEqual({})
  })

  it('sends move-only changes to agent', async () => {
    mockClipboard()
    const originalParent = createTarget('move-send-parent')
    const originalBefore = createTarget('move-send-before')
    const moved = createTarget('move-send-target')
    const originalAfter = createTarget('move-send-after')
    const nextParent = createTarget('move-send-parent-next')
    const nextSibling = createTarget('move-send-next-sibling')

    originalParent.replaceChildren(originalBefore, moved, originalAfter)
    nextParent.replaceChildren(nextSibling)

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(moved)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(moved)
    })

    act(() => {
      nextParent.appendChild(moved)
      result.current.handleMoveComplete(moved, {
        originalParent,
        originalPreviousSibling: originalBefore,
        originalNextSibling: originalAfter,
        mode: 'reorder',
      })
    })

    const sent = await result.current.sendEditToAgent()
    expect(sent).toBe(true)
    expect(sendEditToAgentMock).toHaveBeenCalledTimes(1)

    const payload = sendEditToAgentMock.mock.calls[0][0] as {
      changes: Array<{ cssProperty: string; cssValue: string; tailwindClass: string }>
      moveChange: Record<string, unknown> | null
      exportMarkdown: string
    }
    expect(payload.changes).toEqual([])
    expect(payload.moveChange).toEqual(
      expect.objectContaining({
        mode: 'reorder',
        fromParentName: expect.any(String),
        toParentName: expect.any(String),
      }),
    )
    expect(payload.exportMarkdown).toContain('moved:')
    expect(payload.exportMarkdown).toContain('summary:')
  })

  it('records position move as move metadata with applied left/top', async () => {
    const clipboardWrite = mockClipboard()
    const parent = createTarget('pos-parent')
    const moved = createTarget('pos-moved')
    parent.replaceChildren(moved)
    moved.style.position = 'static'

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(moved)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(moved)
    })

    clipboardWrite.mockClear()

    act(() => {
      result.current.handleMoveComplete(moved, {
        originalParent: parent,
        originalPreviousSibling: null,
        originalNextSibling: null,
        mode: 'position',
        positionDelta: { x: 50, y: 30 },
      })
    })

    expect(moved.style.position).toBe('relative')
    expect(moved.style.left).toBe('50px')
    expect(moved.style.top).toBe('30px')

    const copied = await result.current.exportEdits()
    expect(copied).toBe(true)

    const exported = String(clipboardWrite.mock.calls[0][0])
    expect(exported).toContain('moved:')
    expect(exported).toContain('summary:')
    expect(exported).toContain('mode: position')
    expect(exported).toContain('applied_left: 50px')
    expect(exported).toContain('applied_top: 30px')
    expect(exported).toContain('from_parent_selector')
    expect(exported).toContain('to_parent_selector')
  })

  it('clears position offsets when dropped into flex container and restores on undo', async () => {
    const originalParent = createTarget('flex-drop-parent')
    const moved = createTarget('flex-drop-moved')
    const flexTarget = createTarget('flex-drop-target')
    originalParent.replaceChildren(moved)

    // Simulate element that had position offsets from a prior drag
    moved.style.position = 'relative'
    moved.style.left = '40px'
    moved.style.top = '20px'

    // Pre-reparent into flex container (use-move does this before calling handleMoveComplete)
    flexTarget.appendChild(moved)

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(moved)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(moved)
    })

    act(() => {
      result.current.handleMoveComplete(moved, {
        originalParent,
        originalPreviousSibling: null,
        originalNextSibling: null,
        mode: 'free',
        resetPositionOffsets: true,
      })
    })

    // Position offsets should be cleared
    expect(moved.style.position).toBe('')
    expect(moved.style.left).toBe('')
    expect(moved.style.top).toBe('')
    expect(moved.parentElement).toBe(flexTarget)

    // Undo should restore both DOM position and CSS
    act(() => {
      result.current.undo()
    })

    expect(moved.parentElement).toBe(originalParent)
    expect(moved.style.position).toBe('relative')
    expect(moved.style.left).toBe('40px')
    expect(moved.style.top).toBe('20px')
  })

  it('starts a new comment in one click when the current comment is already submitted', async () => {
    const targetA = createTarget('comment-first', 'padding-top: 8px;')
    const targetB = createTarget('comment-second', 'padding-top: 8px;')
    mockElementFromPoint(targetB)

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.setActiveTool('comment')
      result.current.addComment(targetA, { x: 16, y: 24 })
    })

    const firstCommentId = result.current.activeCommentId
    expect(firstCommentId).not.toBeNull()

    act(() => {
      result.current.updateCommentText(firstCommentId!, 'Keep this comment')
    })

    const overlay = await findOverlayElement()
    act(() => {
      clickOverlay(overlay, 48, 56)
    })

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(2)
      expect(result.current.activeCommentId).not.toBe(firstCommentId)
    })

    const firstComment = result.current.comments.find((comment) => comment.id === firstCommentId)
    expect(firstComment?.text).toBe('Keep this comment')
    const activeComment = result.current.comments.find((comment) => comment.id === result.current.activeCommentId)
    expect(activeComment?.text).toBe('')
  })

  it('blocks new comment creation for unsent drafts and marks the input as invalid', async () => {
    const targetA = createTarget('comment-draft', 'padding-top: 8px;')
    const targetB = createTarget('comment-draft-next', 'padding-top: 8px;')
    mockElementFromPoint(targetB)

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.setActiveTool('comment')
      result.current.addComment(targetA, { x: 20, y: 28 })
    })

    const draftCommentId = result.current.activeCommentId
    expect(draftCommentId).not.toBeNull()

    const host = await waitFor(() => {
      const node = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    const draftInput = await waitFor(() => {
      const input = host.shadowRoot?.querySelector('input[placeholder="Add a comment..."]') as HTMLInputElement | null
      expect(input).not.toBeNull()
      return input as HTMLInputElement
    })

    act(() => {
      fireEvent.change(draftInput, { target: { value: 'Unsent draft' } })
    })

    const overlay = await findOverlayElement()
    act(() => {
      clickOverlay(overlay, 60, 68)
    })

    expect(result.current.comments).toHaveLength(1)
    expect(result.current.activeCommentId).toBe(draftCommentId)

    await waitFor(() => {
      const input = host.shadowRoot?.querySelector('input[placeholder="Add a comment..."]') as HTMLInputElement | null
      expect(input).not.toBeNull()
      expect(input?.getAttribute('aria-invalid')).toBe('true')
    })
  })

  it('tracks session edits, exports all edits, and can clear them', async () => {
    const clipboardWrite = mockClipboard()
    const target = createTarget('session-target', 'padding-top: 6px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    clipboardWrite.mockClear()

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(20))
    })

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(1)
    })

    const edits = result.current.getSessionEdits()
    expect(edits).toHaveLength(1)
    expect(edits[0].pendingStyles['padding-top']).toBe('20px')

    act(() => {
      result.current.addComment(target, { x: 20, y: 24 })
    })
    const commentId = result.current.comments[0].id
    act(() => {
      result.current.updateCommentText(commentId, 'Increase contrast for readability')
    })

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(2)
    })

    const items = result.current.getSessionItems()
    expect(items).toHaveLength(2)
    expect(items.some((item) => item.type === 'comment')).toBe(true)

    clipboardWrite.mockClear()
    const copied = await result.current.exportAllEdits()
    expect(copied).toBe(true)
    expect(clipboardWrite).toHaveBeenCalledTimes(1)
    expect(String(clipboardWrite.mock.calls[0][0])).toContain('padding-top: 20px')
    expect(String(clipboardWrite.mock.calls[0][0])).toContain('comment: Increase contrast for readability')

    act(() => {
      result.current.clearSessionEdits()
    })

    expect(result.current.sessionEditCount).toBe(0)
    expect(result.current.comments).toHaveLength(0)
    expect(target.style.getPropertyValue('padding-top')).toBe('6px')
  })

  it('preserves session edits for previously edited elements after re-selection', async () => {
    const clipboardWrite = mockClipboard()
    const targetA = createTarget('el-a', 'padding-top: 4px;')
    const targetB = createTarget('el-b', 'margin-left: 2px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    // Edit element A
    act(() => { result.current.selectElement(targetA) })
    await waitFor(() => { expect(result.current.selectedElement).toBe(targetA) })
    act(() => { result.current.updateSpacingProperty('paddingTop', cssValue(20)) })
    expect(result.current.pendingStyles['padding-top']).toBe('20px')

    // Switch to element B and edit it
    act(() => { result.current.selectElement(targetB) })
    await waitFor(() => { expect(result.current.selectedElement).toBe(targetB) })
    act(() => { result.current.updateSpacingProperty('marginLeft', cssValue(16)) })
    expect(result.current.pendingStyles['margin-left']).toBe('16px')

    // Re-select element A — this previously deleted A's session edit
    act(() => { result.current.selectElement(targetA) })
    await waitFor(() => { expect(result.current.selectedElement).toBe(targetA) })

    // A's pending styles should be restored from session
    expect(result.current.pendingStyles['padding-top']).toBe('20px')

    // Both edits must survive in the session
    await waitFor(() => { expect(result.current.sessionEditCount).toBe(2) })
    const edits = result.current.getSessionEdits()
    expect(edits).toHaveLength(2)

    // Export all should include both edits
    clipboardWrite.mockClear()
    const copied = await result.current.exportAllEdits()
    expect(copied).toBe(true)
    const exported = String(clipboardWrite.mock.calls[0][0])
    expect(exported).toContain('padding-top: 20px')
    expect(exported).toContain('margin-left: 16px')
  })

  it('restores text edit session state when undoing after reverting to original', async () => {
    const target = createTarget('text-target')
    target.textContent = 'Original text'

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.startTextEditing(target)
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBe(target)
    })

    act(() => {
      target.textContent = 'Edited text'
      result.current.commitTextEditing()
    })

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(1)
    })

    act(() => {
      result.current.startTextEditing(target)
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBe(target)
    })

    act(() => {
      target.textContent = 'Original text'
      result.current.commitTextEditing()
    })

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(0)
    })

    act(() => {
      result.current.undo()
    })

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(1)
    })
    expect(target.textContent).toBe('Edited text')

    const edits = result.current.getSessionEdits()
    expect(edits).toHaveLength(1)
    expect(edits[0].textEdit).toEqual({
      originalText: 'Original text',
      newText: 'Edited text',
    })
  })

  it('commits text editing and clears contenteditable when turning edit mode off', async () => {
    const target = createTarget('toggle-text-target')
    target.textContent = 'Before'

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    act(() => {
      result.current.startTextEditing(target)
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBe(target)
    })
    expect(target.getAttribute('contenteditable')).toBe('true')

    act(() => {
      target.textContent = 'After'
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(false)
      expect(result.current.textEditingElement).toBeNull()
      expect(target.hasAttribute('contenteditable')).toBe(false)
      expect(result.current.sessionEditCount).toBe(1)
    })
    expect(target.textContent).toBe('After')
  })
})

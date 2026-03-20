import * as React from 'react'
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DirectEditProvider, useDirectEdit, useDirectEditActions, useDirectEditState } from './provider'
import { DirectEditPanel } from './panel'
import { SelectionOverlay } from './selection-overlay'
import { DirectEditToolbar } from './toolbar'
import { Rulers } from './rulers-overlay'
import { parsePropertyValue } from './utils'
import { PANEL_WIDTH, PANEL_HEIGHT } from './use-panel-position'

const { checkAgentConnectionMock, sendEditToAgentMock, sendCommentToAgentMock } = vi.hoisted(() => ({
  checkAgentConnectionMock: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  sendEditToAgentMock: vi.fn<(...args: unknown[]) => Promise<{ ok: boolean; id: string }>>().mockResolvedValue({ ok: true, id: 'edit-1' }),
  sendCommentToAgentMock: vi.fn<(...args: unknown[]) => Promise<{ ok: boolean; id: string }>>().mockResolvedValue({ ok: true, id: 'comment-1' }),
}))

vi.mock('./mcp-client', () => ({
  checkAgentConnection: checkAgentConnectionMock,
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

function setNavigatorClipboard(value: Clipboard | undefined) {
  const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard')
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value,
  })
  documentPropertyRestores.push(() => {
    if (descriptor) {
      Object.defineProperty(window.navigator, 'clipboard', descriptor)
      return
    }
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
  })
}

function mockExecCommand() {
  const descriptor = Object.getOwnPropertyDescriptor(document, 'execCommand')
  const execCommand = vi.fn<(...args: unknown[]) => boolean>().mockReturnValue(true)
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: (command: string) => execCommand(command),
  })
  documentPropertyRestores.push(() => {
    if (descriptor) {
      Object.defineProperty(document, 'execCommand', descriptor)
      return
    }
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: undefined,
    })
  })
  return execCommand
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

function clickOverlay(
  overlay: HTMLElement,
  clientX: number,
  clientY: number,
  init: MouseEventInit = {},
) {
  overlay.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX,
    clientY,
    ...init,
  }))
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

async function findHostShadowRoot(): Promise<ShadowRoot> {
  const host = await waitFor(() => {
    const node = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
    expect(node).not.toBeNull()
    return node as HTMLElement
  })

  return waitFor(() => {
    const shadowRoot = host.shadowRoot
    expect(shadowRoot).not.toBeNull()
    return shadowRoot as ShadowRoot
  })
}

async function findSelectedCommentInput(): Promise<HTMLTextAreaElement> {
  const shadowRoot = await findHostShadowRoot()
  return waitFor(() => {
    const input = shadowRoot.querySelector('[data-direct-edit="selected-comment-composer"] textarea') as HTMLTextAreaElement | null
    expect(input).not.toBeNull()
    return input as HTMLTextAreaElement
  })
}

async function clickCommentPill(): Promise<void> {
  const shadowRoot = await findHostShadowRoot()
  const pill = await waitFor(() => {
    const btn = shadowRoot.querySelector('[data-direct-edit="comment-pill"]') as HTMLButtonElement | null
    expect(btn).not.toBeNull()
    return btn as HTMLButtonElement
  })
  act(() => {
    fireEvent.click(pill)
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
    checkAgentConnectionMock.mockResolvedValue(true)
  })

  afterEach(() => {
    while (documentPropertyRestores.length > 0) {
      const restore = documentPropertyRestores.pop()
      restore?.()
    }
    checkAgentConnectionMock.mockClear()
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

  it('exports edits through execCommand fallback when navigator clipboard is unavailable', async () => {
    setNavigatorClipboard(undefined)
    const execCommand = mockExecCommand()
    const target = createTarget('exec-fallback-target', 'padding-top: 8px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(14))
    })

    const copied = await result.current.exportEdits()
    expect(copied).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
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

    const settingsTrigger = await findToolbarButtonByIcon(root, 'lucide-settings-2')
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

  it('changes theme from the preferences theme submenu on click', async () => {
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

    const root = await findHostShadowRoot()
    const settingsTrigger = await findToolbarButtonByIcon(root, 'lucide-settings-2')

    act(() => {
      fireEvent.click(settingsTrigger)
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

    const darkThemeItem = await waitFor(() => {
      const items = Array.from(root.querySelectorAll('[role="menuitem"]')) as HTMLElement[]
      const item = items.find((el) => el.textContent?.trim() === 'Dark')
      expect(item).not.toBeUndefined()
      return item as HTMLElement
    })

    act(() => {
      fireEvent.click(darkThemeItem)
    })

    await waitFor(() => {
      expect(host.getAttribute('data-theme')).toBe('dark')
      expect(localStorage.getItem('direct-edit-theme')).toBe('dark')
      expect(root.textContent).not.toContain('Light')
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

  it('defaults the panel to the bottom-right corner when no saved position exists', async () => {
    stubMatchMedia()
    localStorage.removeItem('direct-edit-panel-position')
    const target = createTarget('panel-default-target', 'padding-top: 8px;')
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

    expect(panel.style.left).toBe(`${window.innerWidth - PANEL_WIDTH - 8}px`)
    expect(panel.style.top).toBe(`${window.innerHeight - PANEL_HEIGHT - 8}px`)
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

  it('uses Cmd+Z for undo on macOS and ignores Ctrl+Z', () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'platform')
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    })

    try {
      const target = createTarget('mac-undo-target', 'padding-top: 4px;')
      const { result } = renderHook(() => useDirectEdit(), { wrapper })

      act(() => {
        result.current.toggleEditMode()
        result.current.selectElement(target)
      })

      act(() => {
        result.current.updateSpacingProperty('paddingTop', parsePropertyValue('16px'))
      })
      expect(target.style.paddingTop).toBe('16px')

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
      })
      expect(target.style.paddingTop).toBe('16px')

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))
      })
      expect(target.style.paddingTop).toBe('4px')
    } finally {
      if (platformDescriptor) {
        Object.defineProperty(window.navigator, 'platform', platformDescriptor)
      }
    }
  })

  it('adds to the current selection on shift-click and renders multi-selection chrome', async () => {
    const targetA = createTarget('shift-multi-a', 'width: 120px; height: 80px;')
    const targetB = createTarget('shift-multi-b', 'width: 120px; height: 80px;')
    mockElementFromPoint(targetB)

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(targetA)
    })

    const overlay = await findOverlayElement()
    act(() => {
      clickOverlay(overlay, 80, 40, { shiftKey: true })
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBeNull()
      expect(result.current.selectedElements).toEqual([targetA, targetB])
    })

    const shadowRoot = await findHostShadowRoot()
    await waitFor(() => {
      expect(shadowRoot.querySelectorAll('[data-direct-edit="selection-overlay-box"]')).toHaveLength(2)
      expect(shadowRoot.querySelector('[data-direct-edit="selection-count-label"]')).toBeNull()
      expect(shadowRoot.querySelector('[data-direct-edit="selected-comment-composer"]')).toBeNull()
    })
  })

  it('supports marquee multi-selection by dragging on the canvas overlay', async () => {
    const targetA = createTarget('marquee-a')
    const targetB = createTarget('marquee-b')
    targetA.getBoundingClientRect = () => ({
      left: 20,
      top: 20,
      width: 80,
      height: 80,
      right: 100,
      bottom: 100,
      x: 20,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect
    targetB.getBoundingClientRect = () => ({
      left: 140,
      top: 24,
      width: 80,
      height: 80,
      right: 220,
      bottom: 104,
      x: 140,
      y: 24,
      toJSON: () => ({}),
    }) as DOMRect

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    const overlay = await findOverlayElement()
    act(() => {
      fireEvent.pointerDown(overlay, { clientX: 0, clientY: 0, button: 0 })
      fireEvent.pointerMove(window, { clientX: 240, clientY: 140 })
    })

    const shadowRoot = await findHostShadowRoot()
    await waitFor(() => {
      expect(shadowRoot.querySelector('[data-direct-edit="marquee-select"]')).not.toBeNull()
    })

    act(() => {
      fireEvent.pointerUp(window, { clientX: 240, clientY: 140, button: 0 })
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBeNull()
      expect(result.current.selectedElements).toEqual([targetA, targetB])
    })

    await waitFor(() => {
      expect(shadowRoot.querySelector('[data-direct-edit="selection-count-label"]')).toBeNull()
      expect(shadowRoot.querySelector('[data-direct-edit="selected-comment-composer"]')).toBeNull()
    })
  })

  it('adds canvas divs and frames from keyboard shortcuts', async () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    const frameCountBefore = document.querySelectorAll('[data-made-refine-canvas-node="frame"]').length
    const divCountBefore = document.querySelectorAll('[data-made-refine-canvas-node="div"]').length

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD' }))
    })

    await waitFor(() => {
      expect(document.querySelectorAll('[data-made-refine-canvas-node="frame"]').length).toBeGreaterThan(frameCountBefore)
      expect(document.querySelectorAll('[data-made-refine-canvas-node="div"]').length).toBeGreaterThan(divCountBefore)
      expect(result.current.selectedElement?.getAttribute('data-made-refine-canvas-node')).toBe('div')
    })
  })

  it('groups multiple canvas nodes into a wrapper', async () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    const divCountBefore = document.querySelectorAll('[data-made-refine-canvas-node="div"]').length

    act(() => {
      result.current.insertElement('div')
      result.current.insertElement('div')
    })

    const nodes = Array.from(
      document.querySelectorAll('[data-made-refine-canvas-node="div"]')
    ).slice(divCountBefore) as HTMLElement[]
    expect(nodes).toHaveLength(2)

    act(() => {
      result.current.selectElements(nodes)
    })

    await waitFor(() => {
      expect(result.current.selectedElements).toEqual(nodes)
    })

    act(() => {
      result.current.groupSelection()
    })

    await waitFor(() => {
      const group = document.querySelector('[data-made-refine-canvas-node="group"]') as HTMLElement | null
      expect(group).not.toBeNull()
      expect(group?.children).toHaveLength(2)
      expect(result.current.selectedElement).toBe(group)
    })
  })

  describe('insertElement frame', () => {
    it('applies minimal styling to frames', async () => {
      const { result } = renderHook(() => useDirectEdit(), { wrapper })

      act(() => {
        result.current.toggleEditMode()
      })

      await waitFor(() => {
        expect(result.current.editModeActive).toBe(true)
      })

      act(() => {
        result.current.insertElement('frame')
      })

      const frame = document.querySelector('[data-made-refine-canvas-node="frame"]') as HTMLElement
      expect(frame).not.toBeNull()
      expect(frame.style.width).toBe('100px')
      expect(frame.style.height).toBe('100px')
      expect(frame.style.background).toBe('rgb(245, 245, 245)')
      expect(frame.style.border).toBe('1px solid rgb(224, 224, 224)')
      expect(frame.style.borderRadius).toBe('')
      expect(frame.style.boxShadow).toBe('')
      expect(frame.style.display).toBe('')
      expect(frame.style.padding).toBe('')
    })

    it('inserts frame on body when no element is selected', async () => {
      const { result } = renderHook(() => useDirectEdit(), { wrapper })

      act(() => {
        result.current.toggleEditMode()
      })

      await waitFor(() => {
        expect(result.current.editModeActive).toBe(true)
      })

      act(() => {
        result.current.insertElement('frame')
      })

      const frame = document.querySelector('[data-made-refine-canvas-node="frame"]') as HTMLElement
      expect(frame).not.toBeNull()
      expect(frame.parentElement).toBe(document.body)
      expect(frame.style.position).toBe('absolute')
    })

    it('inserts frame as sibling after selected element', async () => {
      const container = document.createElement('div')
      container.style.display = 'flex'
      document.body.appendChild(container)
      const child = document.createElement('div')
      child.id = 'sibling-target'
      child.textContent = 'child'
      container.appendChild(child)

      const { result } = renderHook(() => useDirectEdit(), { wrapper })

      act(() => {
        result.current.toggleEditMode()
      })

      await waitFor(() => {
        expect(result.current.editModeActive).toBe(true)
      })

      act(() => {
        result.current.selectElement(child)
      })

      await waitFor(() => {
        expect(result.current.selectedElement).toBe(child)
      })

      act(() => {
        result.current.insertElement('frame')
      })

      const frame = document.querySelector('[data-made-refine-canvas-node="frame"]') as HTMLElement
      expect(frame).not.toBeNull()
      expect(frame.parentElement).toBe(container)
      expect(child.nextElementSibling).toBe(frame)
      expect(frame.style.position).toBe('')
    })

    it('appends frame when selected element is last child', async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const firstChild = document.createElement('div')
      firstChild.textContent = 'first'
      container.appendChild(firstChild)
      const lastChild = document.createElement('div')
      lastChild.id = 'last-child-target'
      lastChild.textContent = 'last'
      container.appendChild(lastChild)

      const { result } = renderHook(() => useDirectEdit(), { wrapper })

      act(() => {
        result.current.toggleEditMode()
      })

      await waitFor(() => {
        expect(result.current.editModeActive).toBe(true)
      })

      act(() => {
        result.current.selectElement(lastChild)
      })

      await waitFor(() => {
        expect(result.current.selectedElement).toBe(lastChild)
      })

      act(() => {
        result.current.insertElement('frame')
      })

      const frame = document.querySelector('[data-made-refine-canvas-node="frame"]') as HTMLElement
      expect(frame).not.toBeNull()
      expect(frame.parentElement).toBe(container)
      expect(container.lastElementChild).toBe(frame)
    })

    it('inserts frame on body when body is selected', async () => {
      const { result } = renderHook(() => useDirectEdit(), { wrapper })

      act(() => {
        result.current.toggleEditMode()
      })

      await waitFor(() => {
        expect(result.current.editModeActive).toBe(true)
      })

      act(() => {
        result.current.selectElement(document.body)
      })

      act(() => {
        result.current.insertElement('frame')
      })

      const frame = document.querySelector('[data-made-refine-canvas-node="frame"]') as HTMLElement
      expect(frame).not.toBeNull()
      expect(frame.parentElement).toBe(document.body)
      expect(frame.style.position).toBe('absolute')
    })

    it('removes sibling-inserted frame on undo', async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const child = document.createElement('div')
      child.id = 'undo-sibling-target'
      child.textContent = 'child'
      container.appendChild(child)

      const { result } = renderHook(() => useDirectEdit(), { wrapper })

      act(() => {
        result.current.toggleEditMode()
      })

      await waitFor(() => {
        expect(result.current.editModeActive).toBe(true)
      })

      act(() => {
        result.current.selectElement(child)
      })

      await waitFor(() => {
        expect(result.current.selectedElement).toBe(child)
      })

      act(() => {
        result.current.insertElement('frame')
      })

      const frame = document.querySelector('[data-made-refine-canvas-node="frame"]') as HTMLElement
      expect(frame).not.toBeNull()
      expect(frame.isConnected).toBe(true)

      act(() => {
        result.current.undo()
      })

      expect(frame.isConnected).toBe(false)
      expect(container.querySelector('[data-made-refine-canvas-node="frame"]')).toBeNull()
    })
  })

  it('blocks native dragstart outside editor chrome while design mode is active', async () => {
    const target = createTarget('dragstart-block-target')
    const editorTarget = document.createElement('div')
    editorTarget.setAttribute('data-direct-edit', 'panel')
    document.body.appendChild(editorTarget)
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    const outsideEvent = new Event('dragstart', { bubbles: true, cancelable: true })
    target.dispatchEvent(outsideEvent)
    expect(outsideEvent.defaultPrevented).toBe(true)

    const insideEvent = new Event('dragstart', { bubbles: true, cancelable: true })
    editorTarget.dispatchEvent(insideEvent)
    expect(insideEvent.defaultPrevented).toBe(false)
  })

  it('blocks horizontal history-swipe gestures in non-canvas design mode when no scroller can consume them', async () => {
    const target = createTarget('wheel-block-target')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })
    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
      expect(result.current.canvas.active).toBe(true)
    })

    act(() => {
      result.current.toggleCanvas()
    })
    await waitFor(() => {
      expect(result.current.canvas.active).toBe(false)
    })

    const wheelEvent = new WheelEvent('wheel', {
      deltaX: 64,
      deltaY: 0,
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(wheelEvent)

    expect(wheelEvent.defaultPrevented).toBe(true)
  })

  it('routes horizontal wheel to nearest horizontal scroller in non-canvas design mode', async () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    const scroller = document.createElement('div')
    scroller.style.overflowX = 'auto'
    const inner = document.createElement('div')
    scroller.appendChild(inner)
    document.body.appendChild(scroller)

    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 300 })
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 100 })
    Object.defineProperty(scroller, 'scrollLeft', { configurable: true, writable: true, value: 0 })

    act(() => {
      result.current.toggleEditMode()
    })
    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
      expect(result.current.canvas.active).toBe(true)
    })

    act(() => {
      result.current.toggleCanvas()
    })
    await waitFor(() => {
      expect(result.current.canvas.active).toBe(false)
    })

    const wheelEvent = new WheelEvent('wheel', {
      deltaX: 40,
      deltaY: 0,
      bubbles: true,
      cancelable: true,
    })
    inner.dispatchEvent(wheelEvent)

    expect(wheelEvent.defaultPrevented).toBe(true)
    expect(scroller.scrollLeft).toBeGreaterThan(0)
  })

  it('keeps canvas horizontal pan active in canvas mode', async () => {
    const target = createTarget('canvas-wheel-target')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })
    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
      expect(result.current.canvas.active).toBe(true)
    })

    const beforePanX = result.current.canvas.panX
    const wheelEvent = new WheelEvent('wheel', {
      deltaX: 50,
      deltaY: 0,
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(wheelEvent)

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    })

    expect(result.current.canvas.panX).not.toBe(beforePanX)
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
      source: string | null
      rawSource: { file?: string } | null
    }
    expect(payload.source).toBe('src/App.tsx:10:2')
    expect(payload.rawSource?.file).toBe('src/App.tsx')
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

  it('clears session edit after successful send to agent', async () => {
    mockClipboard()
    const target = createTarget('clear-after-send-target')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(20))
    })

    expect(result.current.sessionEditCount).toBe(1)
    expect(target.style.paddingTop).toBe('20px')

    let sent: boolean
    await act(async () => {
      sent = await result.current.sendEditToAgent()
    })
    expect(sent!).toBe(true)

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(0)
    })
    // DOM style should be reverted
    expect(target.style.paddingTop).not.toBe('20px')
  })

  it('does not clear session edit when send to agent fails', async () => {
    mockClipboard()
    const target = createTarget('keep-on-fail-target')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(20))
    })

    expect(result.current.sessionEditCount).toBe(1)

    sendEditToAgentMock.mockResolvedValueOnce({ ok: false, id: '' })

    const sent = await result.current.sendEditToAgent()
    expect(sent).toBe(false)

    // Edit should be preserved for retry
    expect(result.current.sessionEditCount).toBe(1)
    expect(target.style.paddingTop).toBe('20px')
  })

  it('clears comment after successful send to agent', async () => {
    mockClipboard()
    const target = createTarget('clear-comment-target', 'padding-top: 8px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.addComment(target, { x: 10, y: 10 })
    })

    expect(result.current.comments).toHaveLength(1)
    const commentId = result.current.comments[0].id

    act(() => {
      result.current.updateCommentText(commentId, 'Fix this layout')
    })

    let sent: boolean
    await act(async () => {
      sent = await result.current.sendCommentToAgent(commentId)
    })
    expect(sent!).toBe(true)

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(0)
    })
  })

  it('clears all session items after successful send-all to agent', async () => {
    mockClipboard()
    const editTarget = createTarget('clear-all-edit-target')
    const commentTarget = createTarget('clear-all-comment-target', 'padding-top: 8px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(editTarget)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(editTarget)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(24))
      result.current.addComment(commentTarget, { x: 10, y: 10 })
    })

    const commentId = result.current.comments[0]?.id
    expect(commentId).toBeDefined()

    act(() => {
      result.current.updateCommentText(commentId!, 'Adjust spacing')
    })

    expect(result.current.sessionEditCount).toBeGreaterThanOrEqual(1)
    expect(result.current.comments).toHaveLength(1)

    sendEditToAgentMock.mockClear()
    sendCommentToAgentMock.mockClear()

    let sent: boolean
    await act(async () => {
      sent = await result.current.sendAllSessionItemsToAgent()
    })
    expect(sent!).toBe(true)

    // Both edit and comment should be cleared
    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(0)
    })
    expect(result.current.comments).toHaveLength(0)
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
    expect(exported).toContain('=== LAYOUT MOVE PLAN ===')
    expect(exported).toContain('id:')
    expect(exported).toContain('type:')
    expect(exported).toContain('implementation_steps:')
    expect(exported).toContain('guardrails:')
    expect(exported).not.toContain('dragged_position')
    expect(exported).toContain('#move-parent-next')
    expect(exported).toContain('instruction:')
  })

  it('falls back to element context export for noop move-only metadata', async () => {
    const clipboardWrite = mockClipboard()
    const parent = createTarget('noop-move-parent')
    const before = createTarget('noop-move-before')
    const moved = createTarget('noop-move-target')
    const after = createTarget('noop-move-after')
    parent.replaceChildren(before, moved, after)

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
        originalPreviousSibling: before,
        originalNextSibling: after,
        mode: 'reorder',
      })
    })

    const copied = await result.current.exportEdits()
    expect(copied).toBe(true)
    expect(clipboardWrite).toHaveBeenCalledTimes(1)

    const exported = String(clipboardWrite.mock.calls[0][0])
    expect(exported).toContain('Here is the element context for reference')
    expect(exported).toContain('target:')
    expect(exported).not.toContain('moved:')
    expect(exported).not.toContain('Implement the move plan below')
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
      moveIntent: Record<string, unknown> | null
      exportMarkdown: string
    }
    expect(payload.changes).toEqual([])
    expect(payload.moveIntent).toEqual(
      expect.objectContaining({
        interactionMode: 'reorder',
        classification: expect.any(String),
      }),
    )
    expect(payload.exportMarkdown).toContain('moved:')
    expect(payload.exportMarkdown).toContain('id:')
  })

  it('sends batch move plan envelope once while preserving operation ids per edit', async () => {
    mockClipboard()
    const originalParent = createTarget('move-batch-parent')
    const movedA = createTarget('move-batch-a')
    const movedB = createTarget('move-batch-b')
    const originalAfter = createTarget('move-batch-after')
    const nextParent = createTarget('move-batch-parent-next')

    originalParent.replaceChildren(movedA, movedB, originalAfter)

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      nextParent.appendChild(movedA)
      result.current.handleMoveComplete(movedA, {
        originalParent,
        originalPreviousSibling: null,
        originalNextSibling: movedB,
        mode: 'reorder',
      })
    })

    act(() => {
      nextParent.appendChild(movedB)
      result.current.handleMoveComplete(movedB, {
        originalParent,
        originalPreviousSibling: movedA,
        originalNextSibling: originalAfter,
        mode: 'reorder',
      })
    })

    sendEditToAgentMock.mockClear()

    const sent = await result.current.sendAllSessionItemsToAgent()
    expect(sent).toBe(true)
    expect(sendEditToAgentMock).toHaveBeenCalledTimes(2)

    const firstPayload = sendEditToAgentMock.mock.calls[0][0] as {
      moveIntent: { operationId: string } | null
      movePlan?: unknown
      exportMarkdown: string
    }
    const secondPayload = sendEditToAgentMock.mock.calls[1][0] as {
      moveIntent: { operationId: string } | null
      movePlan?: unknown
      exportMarkdown: string
    }

    expect(firstPayload.movePlan).toBeTruthy()
    expect(firstPayload.exportMarkdown).toContain('=== LAYOUT MOVE PLAN ===')
    expect(secondPayload.movePlan).toBeUndefined()
    expect(secondPayload.exportMarkdown).not.toContain('=== LAYOUT MOVE PLAN ===')
    expect(firstPayload.moveIntent?.operationId).not.toBe(secondPayload.moveIntent?.operationId)
    expect(secondPayload.exportMarkdown).toContain(`id: ${secondPayload.moveIntent?.operationId}`)
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
    expect(exported).toContain('id:')
    expect(exported).toContain('type:')
    expect(exported).not.toContain('applied_left')
    expect(exported).not.toContain('applied_top')
    expect(exported).not.toContain('dragged_position')
    expect(exported).toContain('parent:')
    expect(exported).toContain('visual_hint:')
    expect(exported).toContain('implementation_steps:')
    expect(exported).toContain('instruction:')
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

  it('starts a new comment when selection changes and the current comment is already submitted', async () => {
    const targetA = createTarget('comment-first', 'padding-top: 8px;')
    const targetB = createTarget('comment-second', 'padding-top: 8px;')
    mockElementFromPoint(targetB)

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(targetA)
    })

    await clickCommentPill()

    await waitFor(() => {
      expect(result.current.activeCommentId).not.toBeNull()
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
      expect(result.current.selectedElement).toBe(targetB)
    })

    await clickCommentPill()

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(2)
      expect(result.current.activeCommentId).not.toBe(firstCommentId)
    })

    const firstComment = result.current.comments.find((comment) => comment.id === firstCommentId)
    expect(firstComment?.text).toBe('Keep this comment')
    const activeComment = result.current.comments.find((comment) => comment.id === result.current.activeCommentId)
    expect(activeComment?.text).toBe('')
    expect(activeComment?.element).toBe(targetB)
  })

  it('blocks reselection for unsent drafts and marks the input as invalid', async () => {
    const targetA = createTarget('comment-draft', 'padding-top: 8px;')
    const targetB = createTarget('comment-draft-next', 'padding-top: 8px;')
    mockElementFromPoint(targetB)

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(targetA)
    })

    await clickCommentPill()

    await waitFor(() => {
      expect(result.current.activeCommentId).not.toBeNull()
    })

    const draftCommentId = result.current.activeCommentId
    expect(draftCommentId).not.toBeNull()

    const draftInput = await findSelectedCommentInput()

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
      expect(draftInput.getAttribute('aria-invalid')).toBe('true')
    })
  })

  it('opens the selected-element composer on comment pill click and positions it below the size label', async () => {
    const target = createTarget('comment-selection-target', 'padding-top: 8px; width: 320px; height: 120px;')
    target.getBoundingClientRect = () => ({
      left: 40,
      top: 60,
      width: 320,
      height: 120,
      right: 360,
      bottom: 180,
      x: 40,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(target)
    })

    await clickCommentPill()

    await waitFor(() => {
      expect(result.current.activeCommentId).not.toBeNull()
    })

    const shadowRoot = await findHostShadowRoot()
    const input = await findSelectedCommentInput()
    const selectionOverlay = shadowRoot.querySelector('[data-direct-edit="selection-overlay"]') as HTMLElement | null
    const dimensionLabel = shadowRoot.querySelector('[data-direct-edit="dimension-label"]') as HTMLElement | null
    const composer = shadowRoot.querySelector('[data-direct-edit="selected-comment-composer"]') as HTMLElement | null

    expect(input.placeholder).toBe('Add a comment...')
    expect(input.tagName).toBe('TEXTAREA')
    expect(selectionOverlay).not.toBeNull()
    expect(dimensionLabel).not.toBeNull()
    expect(composer).not.toBeNull()
    expect(composer?.style.width).toBe('200px')
    expect(shadowRoot.querySelector('[data-direct-edit="comment-pin"]')).toBeNull()
    expect(Number.parseFloat(dimensionLabel?.style.top ?? '0')).toBeGreaterThan(Number.parseFloat(selectionOverlay?.style.top ?? '0'))
    expect(Number.parseFloat(composer?.style.top ?? '0')).toBeGreaterThan(Number.parseFloat(dimensionLabel?.style.top ?? '0'))
  })

  it('does not render copy or apply footer actions inside the panel', async () => {
    const target = createTarget('panel-actions-target', 'padding-top: 8px; width: 320px; height: 120px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(target)
    })

    const shadowRoot = await findHostShadowRoot()
    const panel = await waitFor(() => {
      const node = shadowRoot.querySelector('[data-direct-edit="panel"]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    expect(panel.querySelector('button[aria-label="Copy edits"]')).toBeNull()
    expect(panel.querySelector('button[aria-label="Apply changes via agent"]')).toBeNull()
  })

  it('uses the panel close button to exit design mode', async () => {
    const target = createTarget('panel-close-target', 'padding-top: 8px; width: 320px; height: 120px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(target)
    })

    const shadowRoot = await findHostShadowRoot()
    const closeButton = await waitFor(() => {
      const button = shadowRoot.querySelector('button[aria-label="Close panel"]') as HTMLButtonElement | null
      expect(button).not.toBeNull()
      return button as HTMLButtonElement
    })

    act(() => {
      fireEvent.click(closeButton)
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(false)
    })
  })

  it('pushes the selected comment composer away when it would overlap the toolbar', async () => {
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    const target = createTarget('comment-toolbar-collision-target', 'padding-top: 8px; width: 320px; height: 120px;')
    target.getBoundingClientRect = () => ({
      left: 40,
      top: 60,
      width: 320,
      height: 120,
      right: 360,
      bottom: 180,
      x: 40,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect

    const { result } = renderHook(() => useDirectEdit(), { wrapper: fullUiWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(target)
    })

    await clickCommentPill()

    const shadowRoot = await findHostShadowRoot()
    const toolbar = await waitFor(() => {
      const node = shadowRoot.querySelector('[data-direct-edit="toolbar"]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })
    toolbar.getBoundingClientRect = () => ({
      left: 70,
      top: 200,
      width: 240,
      height: 56,
      right: 310,
      bottom: 256,
      x: 70,
      y: 200,
      toJSON: () => ({}),
    }) as DOMRect

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    await waitFor(() => {
      const composer = shadowRoot.querySelector('[data-direct-edit="selected-comment-composer"]') as HTMLElement | null
      expect(composer).not.toBeNull()
      expect(Number.parseFloat(composer?.style.top ?? '0')).toBeGreaterThanOrEqual(268)
    })
  })

  it('shows a page label for the outer frame and selects it on click', async () => {
    const previousTitle = document.title
    document.title = 'Page name'
    const originalBodyRect = document.body.getBoundingClientRect.bind(document.body)
    documentPropertyRestores.push(() => {
      document.body.getBoundingClientRect = originalBodyRect
    })

    const outer = createTarget('page-frame', 'padding-top: 8px; width: 420px; height: 240px;')
    const inner = createTarget('page-frame-inner', 'padding-top: 8px; width: 160px; height: 80px;')
    document.body.getBoundingClientRect = () => ({
      left: 12,
      top: 28,
      width: 640,
      height: 480,
      right: 652,
      bottom: 508,
      x: 12,
      y: 28,
      toJSON: () => ({}),
    }) as DOMRect
    outer.getBoundingClientRect = () => ({
      left: 24,
      top: 40,
      width: 420,
      height: 240,
      right: 444,
      bottom: 280,
      x: 24,
      y: 40,
      toJSON: () => ({}),
    }) as DOMRect
    inner.getBoundingClientRect = () => ({
      left: 60,
      top: 90,
      width: 160,
      height: 80,
      right: 220,
      bottom: 170,
      x: 60,
      y: 90,
      toJSON: () => ({}),
    }) as DOMRect
    outer.appendChild(inner)

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(inner)
    })

    const shadowRoot = await findHostShadowRoot()
    const pageLabel = await waitFor(() => {
      const label = shadowRoot.querySelector('[data-direct-edit="page-frame-label"]') as HTMLButtonElement | null
      expect(label).not.toBeNull()
      expect(label?.textContent).toBe('Page name')
      return label as HTMLButtonElement
    })

    act(() => {
      fireEvent.click(pageLabel)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(document.body)
    })

    document.title = previousTitle
  })

  it('does not auto-open the inline comment composer from a stale selection when turning edit mode on', async () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.selectElement(document.body)
    })

    expect(result.current.selectedElement).toBe(document.body)
    expect(result.current.activeCommentId).toBeNull()

    act(() => {
      result.current.toggleEditMode()
    })

    const shadowRoot = await findHostShadowRoot()

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
      expect(result.current.activeCommentId).toBeNull()
    })

    expect(shadowRoot.querySelector('[data-direct-edit="selected-comment-composer"]')).toBeNull()
  })

  it('shows the inline comment composer when the body-level page frame is explicitly selected', async () => {
    const previousTitle = document.title
    document.title = 'Page name'

    const originalBodyRect = document.body.getBoundingClientRect.bind(document.body)
    documentPropertyRestores.push(() => {
      document.body.getBoundingClientRect = originalBodyRect
      document.title = previousTitle
    })

    const outer = createTarget('page-frame-comment-outer', 'padding-top: 12px; width: 420px; height: 260px;')
    const inner = createTarget('page-frame-comment-inner', 'padding-top: 8px; width: 160px; height: 80px;')
    document.body.getBoundingClientRect = () => ({
      left: 12,
      top: 60,
      width: 640,
      height: 480,
      right: 652,
      bottom: 540,
      x: 12,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect
    outer.getBoundingClientRect = () => ({
      left: 40,
      top: 80,
      width: 420,
      height: 260,
      right: 460,
      bottom: 340,
      x: 40,
      y: 80,
      toJSON: () => ({}),
    }) as DOMRect
    inner.getBoundingClientRect = () => ({
      left: 60,
      top: 100,
      width: 160,
      height: 80,
      right: 220,
      bottom: 180,
      x: 60,
      y: 100,
      toJSON: () => ({}),
    }) as DOMRect
    outer.appendChild(inner)

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(inner)
    })

    const shadowRoot = await findHostShadowRoot()
    const pageLabel = await waitFor(() => {
      const label = shadowRoot.querySelector('[data-direct-edit="page-frame-label"]') as HTMLButtonElement | null
      expect(label).not.toBeNull()
      return label as HTMLButtonElement
    })

    act(() => {
      fireEvent.click(pageLabel)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(document.body)
    })

    await clickCommentPill()

    await waitFor(() => {
      expect(result.current.activeCommentId).not.toBeNull()
    })

    expect(shadowRoot.querySelector('[data-direct-edit="selected-comment-composer"]')).not.toBeNull()
    document.title = previousTitle
  })

  it('keeps the page label spacing fixed and text unchanged across canvas zoom', async () => {
    const originalBodyRect = document.body.getBoundingClientRect.bind(document.body)
    documentPropertyRestores.push(() => {
      document.body.getBoundingClientRect = originalBodyRect
    })

    const inner = createTarget('zoom-page-frame-inner', 'padding-top: 8px; width: 160px; height: 80px;')
    document.body.getBoundingClientRect = () => ({
      left: 12,
      top: 60,
      width: 640,
      height: 480,
      right: 652,
      bottom: 540,
      x: 12,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect
    inner.getBoundingClientRect = () => ({
      left: 60,
      top: 90,
      width: 160,
      height: 80,
      right: 220,
      bottom: 170,
      x: 60,
      y: 90,
      toJSON: () => ({}),
    }) as DOMRect

    const { container, rerender } = render(
      <SelectionOverlay
        selectedElement={inner}
        pageFrameElement={document.body}
        pageFrameLabel="Page name"
        canvasZoom={0.5}
        isDragging={false}
        onMoveStart={() => {}}
      />,
    )

    const pageLabel = await waitFor(() => {
      const label = container.querySelector('[data-direct-edit="page-frame-label"]') as HTMLButtonElement | null
      expect(label).not.toBeNull()
      return label as HTMLButtonElement
    })

    expect(pageLabel.style.fontSize).toBe('11px')
    expect(pageLabel.style.lineHeight).toBe('16px')
    expect(pageLabel.style.top).toBe('36px')

    rerender(
      <SelectionOverlay
        selectedElement={inner}
        pageFrameElement={document.body}
        pageFrameLabel="Page name"
        canvasZoom={2}
        isDragging={false}
        onMoveStart={() => {}}
      />,
    )

    const zoomedInPageLabel = await waitFor(() => {
      const label = container.querySelector('[data-direct-edit="page-frame-label"]') as HTMLButtonElement | null
      expect(label).not.toBeNull()
      return label as HTMLButtonElement
    })

    expect(zoomedInPageLabel.style.fontSize).toBe('11px')
    expect(zoomedInPageLabel.style.lineHeight).toBe('16px')
    expect(zoomedInPageLabel.style.top).toBe('36px')
  })

  it('stops parent and child selection at the body boundary', async () => {
    const pageRoot = createTarget('page-root', 'padding-top: 8px; width: 420px; height: 240px;')
    const child = createTarget('page-child', 'padding-top: 8px; width: 160px; height: 80px;')
    pageRoot.appendChild(child)

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(pageRoot)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(pageRoot)
      expect(result.current.elementInfo?.parentElement).toBe(document.body)
    })

    act(() => {
      result.current.selectParent()
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(document.body)
      expect(result.current.elementInfo?.parentElement).toBeNull()
    })

    act(() => {
      result.current.selectParent()
    })

    expect(result.current.selectedElement).toBe(document.body)

    act(() => {
      result.current.selectChild()
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(pageRoot)
    })
  })

  it('hides apply buttons when agent connection is offline and keeps copy controls visible', async () => {
    checkAgentConnectionMock.mockResolvedValue(false)
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    })

    const target = createTarget('offline-agent-target', 'padding-top: 8px; width: 320px; height: 120px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper: fullUiWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(target)
    })

    const shadowRoot = await findHostShadowRoot()

    await waitFor(() => {
      expect(result.current.agentAvailable).toBe(false)
      expect(shadowRoot.querySelector('[data-direct-edit="apply-all-button"]')).toBeNull()
      expect(shadowRoot.querySelector('button[aria-label="Apply changes via agent"]')).toBeNull()
      expect(shadowRoot.querySelector('svg.lucide-copy')).not.toBeNull()
    })
  })

  it('submits inline comments as replies when the element already has a submitted thread', async () => {
    const clipboardWrite = mockClipboard()
    const target = createTarget('comment-inline-reply-target', 'padding-top: 8px; width: 320px; height: 120px;')

    const { result } = renderHook(() => useDirectEdit(), { wrapper: panelWrapper })

    act(() => {
      result.current.toggleEditMode()
      result.current.selectElement(target)
    })

    await clickCommentPill()

    const firstInput = await findSelectedCommentInput()
    act(() => {
      fireEvent.change(firstInput, { target: { value: 'First comment' } })
      fireEvent.keyDown(firstInput, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(1)
      expect(result.current.comments[0].text).toBe('First comment')
    })

    act(() => {
      result.current.setActiveCommentId(null)
      result.current.addComment(target, { x: 24, y: 28 })
    })

    const replyInput = await findSelectedCommentInput()
    act(() => {
      fireEvent.change(replyInput, { target: { value: 'Second comment' } })
      fireEvent.keyDown(replyInput, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(1)
      expect(result.current.comments[0].text).toBe('First comment')
      expect(result.current.comments[0].replies).toEqual([
        expect.objectContaining({ text: 'Second comment' }),
      ])
    })

    const shadowRoot = await findHostShadowRoot()
    const lastClipboardCall = clipboardWrite.mock.calls[clipboardWrite.mock.calls.length - 1]
    expect(shadowRoot.querySelectorAll('[data-direct-edit="comment-pin"]')).toHaveLength(1)
    expect(String(lastClipboardCall?.[0] ?? '')).toContain('reply: Second comment')
    expect(result.current.activeCommentId).toBe(result.current.comments[0].id)
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

  it('blocks app element clicks while text editing is active in design mode', async () => {
    const editable = document.createElement('a')
    editable.id = 'editable-link'
    editable.href = 'https://example.com'
    editable.textContent = 'Editable text'
    document.body.appendChild(editable)

    const outsideButton = document.createElement('button')
    outsideButton.id = 'outside-click-target'
    outsideButton.textContent = 'Click me'
    document.body.appendChild(outsideButton)
    const outsideClickSpy = vi.fn()
    outsideButton.addEventListener('click', outsideClickSpy)

    const editableClickSpy = vi.fn()
    editable.addEventListener('click', editableClickSpy)

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(editable)
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    act(() => {
      result.current.startTextEditing(editable)
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBe(editable)
      expect(editable.getAttribute('contenteditable')).toBe('true')
    })

    const outsideClick = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })
    outsideButton.dispatchEvent(outsideClick)

    expect(outsideClick.defaultPrevented).toBe(true)
    expect(outsideClickSpy).not.toHaveBeenCalled()

    const editableClick = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })
    editable.dispatchEvent(editableClick)

    expect(editableClick.defaultPrevented).toBe(true)
    expect(editableClickSpy).not.toHaveBeenCalled()
    expect(result.current.textEditingElement).toBe(editable)
  })

  it('uses text cursor while editing text on links and buttons, then restores cursor', async () => {
    const link = document.createElement('a')
    link.id = 'cursor-link'
    link.href = 'https://example.com'
    link.textContent = 'Edit link text'
    link.style.cursor = 'pointer'
    document.body.appendChild(link)

    const button = document.createElement('button')
    button.id = 'cursor-button'
    button.textContent = 'Edit button text'
    button.style.cursor = 'pointer'
    document.body.appendChild(button)

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(link)
      result.current.toggleEditMode()
      result.current.startTextEditing(link)
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBe(link)
      expect(link.style.cursor).toBe('text')
    })

    act(() => {
      result.current.commitTextEditing()
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBeNull()
      expect(link.style.cursor).toBe('pointer')
    })

    act(() => {
      result.current.selectElement(button)
      result.current.startTextEditing(button)
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBe(button)
      expect(button.style.cursor).toBe('text')
    })

    act(() => {
      result.current.commitTextEditing()
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBeNull()
      expect(button.style.cursor).toBe('pointer')
    })
  })

  it('deletes a selected element and restores it on undo', async () => {
    const target = createTarget('delete-target', 'padding-top: 8px;')
    const parent = target.parentElement!
    const nextSibling = target.nextSibling

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.deleteSelection()
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBeNull()
      expect(result.current.selectedElements).toEqual([])
    })
    expect(target.isConnected).toBe(false)

    act(() => {
      result.current.undo()
    })

    await waitFor(() => {
      expect(target.isConnected).toBe(true)
      expect(result.current.selectedElement).toBe(target)
    })
    expect(target.parentElement).toBe(parent)
    if (nextSibling) {
      expect(target.nextSibling).toBe(nextSibling)
    }
  })

  it('deletes multiple selected elements and restores all on undo', async () => {
    const target1 = createTarget('multi-del-1')
    const target2 = createTarget('multi-del-2')
    const parent = target1.parentElement!

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    act(() => {
      result.current.selectElements([target1, target2])
    })

    await waitFor(() => {
      expect(result.current.selectedElements).toHaveLength(2)
    })

    act(() => {
      result.current.deleteSelection()
    })

    await waitFor(() => {
      expect(result.current.selectedElements).toEqual([])
    })
    expect(target1.isConnected).toBe(false)
    expect(target2.isConnected).toBe(false)

    act(() => {
      result.current.undo()
    })

    await waitFor(() => {
      expect(target1.isConnected).toBe(true)
      expect(target2.isConnected).toBe(true)
    })
    expect(target1.parentElement).toBe(parent)
    expect(target2.parentElement).toBe(parent)
  })

  it('does not delete when edit mode is inactive', async () => {
    const target = createTarget('no-del-inactive')

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.deleteSelection()
    })

    expect(target.isConnected).toBe(true)
  })

  it('does not delete when no element is selected', async () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    act(() => {
      result.current.deleteSelection()
    })

    // Should not throw
    expect(result.current.editModeActive).toBe(true)
  })

  it('does not delete document.body', async () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    act(() => {
      result.current.selectElement(document.body)
    })

    await waitFor(() => {
      expect(result.current.selectedElements.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.deleteSelection()
    })

    expect(document.body.isConnected).toBe(true)
  })

  it('cleans up session edits on delete and restores them on undo', async () => {
    const target = createTarget('session-del-target', 'padding-top: 4px;')

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(16))
    })

    await waitFor(() => {
      expect(Object.keys(result.current.pendingStyles).length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.deleteSelection()
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBeNull()
    })
    expect(target.isConnected).toBe(false)

    act(() => {
      result.current.undo()
    })

    await waitFor(() => {
      expect(target.isConnected).toBe(true)
      expect(result.current.selectedElement).toBe(target)
    })

    // Session edit should be restored after undo
    const edits = result.current.getSessionEdits()
    const restored = edits.find((e) => e.element === target)
    expect(restored).toBeDefined()
  })
})

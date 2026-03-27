import * as React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DirectEditToolbarInner } from './toolbar'
import type { SessionItem } from './types'

const { handlePointerDownMock, handlePointerMoveMock, handlePointerUpMock, handlePointerCancelMock } = vi.hoisted(() => ({
  handlePointerDownMock: vi.fn(),
  handlePointerMoveMock: vi.fn(),
  handlePointerUpMock: vi.fn(),
  handlePointerCancelMock: vi.fn(),
}))

vi.mock('./use-toolbar-dock', () => ({
  useToolbarDock: () => ({
    dockedEdge: 'bottom',
    isDragging: false,
    isSnapping: false,
    style: {},
    predictSize: vi.fn(),
    handlePointerDown: handlePointerDownMock,
    handlePointerMove: handlePointerMoveMock,
    handlePointerUp: handlePointerUpMock,
    handlePointerCancel: handlePointerCancelMock,
  }),
}))

vi.mock('@base-ui/react/menu', () => {
  const MenuContext = React.createContext<{ open: boolean; onOpenChange?: (open: boolean) => void }>({
    open: false,
  })

  return {
    Menu: {
      Root: ({ children, open = false, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
        <MenuContext.Provider value={{ open, onOpenChange }}>{children}</MenuContext.Provider>
      ),
      Trigger: React.forwardRef<HTMLButtonElement, { render?: React.ReactElement; children?: React.ReactNode }>(
        ({ render, children }, ref) => {
          const { open, onOpenChange } = React.useContext(MenuContext)
          const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
            render?.props.onClick?.(event)
            onOpenChange?.(!open)
          }
          if (render) {
            return React.cloneElement(render, { ref, onClick: handleClick }, children)
          }
          return <button ref={ref} type="button" onClick={handleClick}>{children}</button>
        },
      ),
      Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      Positioner: ({ children, sideOffset: _sideOffset, collisionAvoidance: _collisionAvoidance, ...props }: React.ComponentPropsWithoutRef<'div'> & { sideOffset?: number; collisionAvoidance?: unknown }) => (
        <div {...props}>{children}</div>
      ),
      Popup: React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
        ({ children, ...props }, ref) => (
          <div ref={ref} {...props}>{children}</div>
        ),
      ),
      SubmenuRoot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      SubmenuTrigger: React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'> & { openOnHover?: boolean }>(
        ({ children, openOnHover, ...props }, ref) => (
          <button ref={ref} type="button" data-open-on-hover={openOnHover ? 'true' : 'false'} {...props}>{children}</button>
        ),
      ),
      Item: React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>(
        ({ children, ...props }, ref) => (
          <button ref={ref} type="button" {...props}>{children}</button>
        ),
      ),
    },
  }
})

vi.mock('@base-ui/react/popover', () => ({
  Popover: {
    Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Trigger: React.forwardRef<HTMLButtonElement, { render?: React.ReactElement; children?: React.ReactNode; nativeButton?: boolean }>(
      ({ render, children, nativeButton: _nativeButton }, ref) => {
        if (render) {
          return React.cloneElement(render, { ref }, children)
        }
        return <button ref={ref} type="button">{children}</button>
      },
    ),
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Positioner: ({ children, sideOffset: _sideOffset, side: _side, ...props }: React.ComponentPropsWithoutRef<'div'> & { sideOffset?: number; side?: string }) => (
      <div {...props}>{children}</div>
    ),
    Popup: React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
      ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>{children}</div>
      ),
    ),
  },
}))

vi.mock('./ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<'button'> & { render?: React.ReactElement; nativeButton?: boolean }>(
    ({ children, render, nativeButton: _nativeButton, ...props }, ref) => {
      if (render) {
        return React.cloneElement(render, { ...props, ref }, children)
      }
      return <button ref={ref as React.Ref<HTMLButtonElement>} type="button" {...props}>{children}</button>
    },
  ),
  TooltipContent: ({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) => (
    <div {...props}>{children}</div>
  ),
}))

describe('DirectEditToolbarInner', () => {
  it('allows dragging from divider gaps between toolbar buttons', () => {
    handlePointerDownMock.mockClear()

    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
      />,
    )

    const divider = container.querySelector('[data-direct-edit="toolbar-divider"]') as HTMLElement | null
    expect(divider).not.toBeNull()

    fireEvent.pointerDown(divider as HTMLElement, { clientX: 100, clientY: 20, pointerId: 1 })

    expect(handlePointerDownMock).toHaveBeenCalled()
  })

  it('shows rulers and canvas mode directly in the settings menu', async () => {
    const onToggleCanvas = vi.fn()
    const onToggleRulers = vi.fn()
    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={onToggleRulers}
        canvasActive={false}
        onToggleCanvas={onToggleCanvas}
      />,
    )

    const settingsTrigger = container.querySelector('svg.lucide-settings-2')?.closest('button')
    expect(settingsTrigger).not.toBeNull()
    fireEvent.click(settingsTrigger as HTMLButtonElement)

    expect(onToggleCanvas).not.toHaveBeenCalled()
    expect(onToggleRulers).not.toHaveBeenCalled()

    const rulersButton = Array.from(container.querySelectorAll('button')).find((button) => (
      button.textContent?.trim() === 'Rulers'
    ))
    expect(rulersButton).not.toBeNull()
    fireEvent.click(rulersButton as HTMLButtonElement)
    expect(onToggleRulers).toHaveBeenCalledTimes(1)

    const canvasModeButton = Array.from(container.querySelectorAll('button')).find((button) => (
      button.textContent?.trim() === 'Canvas mode'
    ))
    expect(canvasModeButton).not.toBeNull()
    fireEvent.click(canvasModeButton as HTMLButtonElement)
    expect(onToggleCanvas).toHaveBeenCalledTimes(1)

    expect(document.body.textContent).not.toContain('Actual size (100%)')
    expect(document.body.textContent).not.toContain('Fit to viewport')
  })

  it('closes popovers when edit mode is turned off', async () => {
    const { container, rerender } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
      />,
    )

    const settingsTrigger = container.querySelector('svg.lucide-settings-2')?.closest('button')
    expect(settingsTrigger).not.toBeNull()
    fireEvent.click(settingsTrigger as HTMLButtonElement)

    await waitFor(() => {
      expect(settingsTrigger?.className).toContain('bg-muted text-foreground')
    })

    rerender(
      <DirectEditToolbarInner
        editModeActive={false}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
      />,
    )

    await waitFor(() => {
      const nextSettingsTrigger = container.querySelector('svg.lucide-settings-2')?.closest('button')
      expect(nextSettingsTrigger).not.toBeNull()
      expect(nextSettingsTrigger?.className).not.toContain('bg-muted text-foreground')
    })
  })

  it('uses theme-token classes for keyboard shortcuts', () => {
    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
      />,
    )

    const shortcutKeycaps = Array.from(container.querySelectorAll('kbd'))
    expect(shortcutKeycaps.length).toBeGreaterThan(0)

    for (const keycap of shortcutKeycaps) {
      expect(keycap.className).toContain('bg-muted')
      expect(keycap.className).toContain('text-muted-foreground')
      expect(keycap.className).not.toContain('dark:')
    }
  })

  it('does not render the built-in comment toggle button', () => {
    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
        activeTool="comment"
      />,
    )

    expect(container.querySelector('svg.lucide-message-square')).toBeNull()
  })

  it('renders frame and text insert buttons only when insertion is enabled', () => {
    const onInsertElement = vi.fn()
    const { container, rerender } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
        onInsertElement={onInsertElement}
      />,
    )

    const frameButton = container.querySelector('svg.lucide-square')?.closest('button')
    const textButton = container.querySelector('svg.lucide-type')?.closest('button')
    expect(frameButton).not.toBeNull()
    expect(textButton).not.toBeNull()

    fireEvent.click(frameButton as HTMLButtonElement)
    fireEvent.click(textButton as HTMLButtonElement)

    expect(onInsertElement).toHaveBeenNthCalledWith(1, 'frame')
    expect(onInsertElement).toHaveBeenNthCalledWith(2, 'text')

    rerender(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
      />,
    )

    expect(container.querySelector('svg.lucide-square')).toBeNull()
    expect(container.querySelector('svg.lucide-type')).toBeNull()
  })

  it('omits toggle-comments from the keyboard shortcuts menu', async () => {
    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
      />,
    )

    const settingsTrigger = container.querySelector('svg.lucide-settings-2')?.closest('button')
    expect(settingsTrigger).not.toBeNull()
    fireEvent.click(settingsTrigger as HTMLButtonElement)

    const shortcutsTrigger = await waitFor(() => {
      const found = Array.from(document.body.querySelectorAll('*')).find((node) => (
        node.textContent?.trim() === 'Keyboard shortcuts'
      ))
      expect(found).toBeTruthy()
      return found as HTMLElement
    })

    fireEvent.click(shortcutsTrigger)

    await waitFor(() => {
      expect(document.body.textContent).toContain('Toggle design mode')
      expect(document.body.textContent).toContain('Group selection')
      expect(document.body.textContent).toContain('Add frame')
      expect(document.body.textContent).toContain('Add text')
      expect(document.body.textContent).toContain('Add div')
      expect(document.body.textContent).not.toContain('Toggle comments')
    })
  })

  it('configures settings submenus to open on click', async () => {
    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
      />,
    )

    const settingsTrigger = container.querySelector('svg.lucide-settings-2')?.closest('button')
    expect(settingsTrigger).not.toBeNull()
    fireEvent.click(settingsTrigger as HTMLButtonElement)

    const themeTrigger = Array.from(container.querySelectorAll('button')).find((button) => (
      button.textContent?.trim() === 'Theme'
    ))
    const shortcutsTrigger = Array.from(container.querySelectorAll('button')).find((button) => (
      button.textContent?.trim() === 'Keyboard shortcuts'
    ))

    expect(themeTrigger?.getAttribute('data-open-on-hover')).toBe('false')
    expect(shortcutsTrigger?.getAttribute('data-open-on-hover')).toBe('false')
  })

  it('marks settings popups as editor chrome so clicks do not fall through', async () => {
    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
      />,
    )

    const settingsTrigger = container.querySelector('svg.lucide-settings-2')?.closest('button')
    expect(settingsTrigger).not.toBeNull()
    fireEvent.click(settingsTrigger as HTMLButtonElement)

    const popups = Array.from(container.querySelectorAll('[data-direct-edit="settings-menu"], [data-direct-edit="settings-submenu"]'))
    expect(popups.length).toBeGreaterThan(0)
  })

  it('ignores row keybind when key event originates from nested delete button', async () => {
    const writeText = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const commentItem: SessionItem = {
      type: 'comment',
      comment: {
        id: 'comment-1',
        element: document.createElement('div'),
        locator: {
          reactStack: [],
          domSelector: '#comment-1',
          domContextHtml: '<div></div>',
          targetHtml: '<div id="comment-1"></div>',
          textPreview: 'Need more visual hierarchy',
          tagName: 'div',
          id: 'comment-1',
          classList: [],
        },
        clickPosition: { x: 12, y: 20 },
        relativePosition: { x: 0, y: 0 },
        text: 'Need more visual hierarchy',
        createdAt: Date.now(),
        replies: [],
      },
    }

    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
        sessionEditCount={1}
        onGetSessionItems={() => [commentItem]}
      />,
    )

    const editsTrigger = container.querySelector('svg.lucide-copy')?.closest('button')
    expect(editsTrigger).not.toBeNull()
    fireEvent.click(editsTrigger as HTMLButtonElement)

    const row = await waitFor(() => {
      const found = Array.from(document.body.querySelectorAll('div[role="button"][tabindex="0"]'))
      const target = found.find((node) => node.textContent?.includes('Need more visual hierarchy'))
      expect(target).toBeTruthy()
      return target as HTMLDivElement
    })

    const deleteButton = row.querySelector('button')
    expect(deleteButton).not.toBeNull()
    fireEvent.keyDown(deleteButton as HTMLButtonElement, { key: 'Enter' })
    expect(writeText).not.toHaveBeenCalled()

    fireEvent.keyDown(row, { key: 'Enter' })
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
  })

  it('renders an apply button next to copy and sends all items from the toolbar', async () => {
    const onSendAllToAgents = vi.fn<(...args: unknown[]) => Promise<boolean>>().mockResolvedValue(true)
    const commentItem: SessionItem = {
      type: 'comment',
      comment: {
        id: 'comment-send-all',
        element: document.createElement('div'),
        locator: {
          reactStack: [],
          domSelector: '#comment-send-all',
          domContextHtml: '<div></div>',
          targetHtml: '<div id="comment-send-all"></div>',
          textPreview: 'Align this section with header',
          tagName: 'div',
          id: 'comment-send-all',
          classList: [],
        },
        clickPosition: { x: 8, y: 16 },
        relativePosition: { x: 0, y: 0 },
        text: 'Align this section with header',
        createdAt: Date.now(),
        replies: [],
      },
    }

    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
        sessionEditCount={1}
        onGetSessionItems={() => [commentItem]}
        onSendAllToAgents={onSendAllToAgents}
      />,
    )

    const editsTrigger = container.querySelector('svg.lucide-copy')?.closest('button')
    expect(editsTrigger).not.toBeNull()
    const applyButton = container.querySelector('[data-direct-edit="apply-all-button"]') as HTMLButtonElement | null
    const settingsTrigger = container.querySelector('svg.lucide-settings-2')?.closest('button') as HTMLButtonElement | null
    expect(applyButton).not.toBeNull()
    expect(settingsTrigger).not.toBeNull()
    const editsButton = editsTrigger as HTMLButtonElement
    const applyAllButton = applyButton as HTMLButtonElement
    const settingsButton = settingsTrigger as HTMLButtonElement
    expect(editsButton.compareDocumentPosition(applyAllButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(applyAllButton.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelectorAll('[data-direct-edit="toolbar-divider"]')).toHaveLength(2)

    fireEvent.click(applyAllButton)
    await waitFor(() => {
      expect(onSendAllToAgents).toHaveBeenCalledTimes(1)
    })
  })

  it('hides the apply button when the agent connection is unavailable', () => {
    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
        sessionEditCount={1}
        onSendAllToAgents={vi.fn().mockResolvedValue(true)}
        agentAvailable={false}
      />,
    )

    expect(container.querySelector('[data-direct-edit="apply-all-button"]')).toBeNull()
    expect(container.querySelector('svg.lucide-copy')?.closest('button')).not.toBeNull()
    expect(container.querySelectorAll('[data-direct-edit="toolbar-divider"]')).toHaveLength(2)
  })

  it('keeps move operation id parity when copying a single moved item', async () => {
    const writeText = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const firstEl = document.createElement('button')
    const secondEl = document.createElement('button')

    const firstEdit: SessionItem = {
      type: 'edit',
      edit: {
        element: firstEl,
        locator: {
          reactStack: [{ name: 'App' }],
          domSelector: '#root > div > button:first-of-type',
          domContextHtml: '<div><button>First</button><button>Second</button></div>',
          targetHtml: '<button>First</button>',
          textPreview: 'First',
          tagName: 'button',
          id: null,
          classList: [],
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
          mode: 'position',
          visualDelta: { x: 100, y: 0 },
        },
      },
    }

    const secondEdit: SessionItem = {
      type: 'edit',
      edit: {
        element: secondEl,
        locator: {
          reactStack: [{ name: 'App' }],
          domSelector: '#root > div > button:last-of-type',
          domContextHtml: '<div><button>First</button><button>Second</button></div>',
          targetHtml: '<button>Second</button>',
          textPreview: 'Second',
          tagName: 'button',
          id: null,
          classList: [],
          domSource: { file: 'App.tsx', line: 20, column: 9 },
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
          mode: 'position',
          visualDelta: { x: 180, y: -20 },
        },
      },
    }

    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
        sessionEditCount={2}
        onGetSessionItems={() => [firstEdit, secondEdit]}
      />,
    )

    const editsTrigger = container.querySelector('svg.lucide-copy')?.closest('button')
    expect(editsTrigger).not.toBeNull()
    fireEvent.click(editsTrigger as HTMLButtonElement)

    const targetRow = await waitFor(() => {
      const found = Array.from(document.body.querySelectorAll('div[role="button"][tabindex="0"]'))
      const row = found.find((node) => node.textContent?.includes('op-2'))
      expect(row).toBeTruthy()
      return row as HTMLDivElement
    })

    fireEvent.keyDown(targetRow, { key: 'Enter' })

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const copied = String(writeText.mock.calls[0][0])
    expect(copied).toContain('id: op-2')
    expect(copied).not.toContain('id: op-1')
    expect(copied).not.toContain('=== LAYOUT MOVE PLAN ===')
  })

  it('does not include move-plan instruction for style edits with noop move metadata', async () => {
    const writeText = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const item: SessionItem = {
      type: 'edit',
      edit: {
        element: document.createElement('button'),
        locator: {
          reactStack: [{ name: 'App' }],
          domSelector: '#root > div > button',
          domContextHtml: '<div><button>CTA</button></div>',
          targetHtml: '<button>CTA</button>',
          textPreview: 'CTA',
          tagName: 'button',
          id: null,
          classList: [],
          domSource: { file: 'App.tsx', line: 15, column: 7 },
        },
        originalStyles: {},
        pendingStyles: { color: 'rgb(255, 0, 0)' },
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
      },
    }

    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
        sessionEditCount={1}
        onGetSessionItems={() => [item]}
      />,
    )

    const editsTrigger = container.querySelector('svg.lucide-copy')?.closest('button')
    expect(editsTrigger).not.toBeNull()
    fireEvent.click(editsTrigger as HTMLButtonElement)

    const row = await waitFor(() => {
      const found = Array.from(document.body.querySelectorAll('div[role="button"][tabindex="0"]'))
      const target = found.find((node) => node.textContent?.includes('color: rgb(255, 0, 0)'))
      expect(target).toBeTruthy()
      return target as HTMLDivElement
    })

    fireEvent.keyDown(row, { key: 'Enter' })

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const copied = String(writeText.mock.calls[0][0])
    expect(copied).toContain('Apply the CSS changes')
    expect(copied).toContain('color: rgb(255, 0, 0)')
    expect(copied).not.toContain('Implement the move plan below')
    expect(copied).not.toContain('moved:')
  })
})

import * as React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DirectEditToolbarInner } from './toolbar'
import type { SessionItem } from './types'

vi.mock('./use-toolbar-dock', () => ({
  useToolbarDock: () => ({
    dockedEdge: 'bottom',
    isDragging: false,
    isSnapping: false,
    style: {},
    predictSize: vi.fn(),
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerUp: vi.fn(),
    handlePointerCancel: vi.fn(),
  }),
}))

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
  it('opens zoom popover without toggling canvas mode from toolbar icon', async () => {
    const onToggleCanvas = vi.fn()
    const { container } = render(
      <DirectEditToolbarInner
        editModeActive={true}
        onToggleEditMode={() => {}}
        rulersVisible={false}
        onToggleRulers={() => {}}
        canvasActive={false}
        onToggleCanvas={onToggleCanvas}
      />,
    )

    const canvasTrigger = container.querySelector('svg.lucide-maximize-2')?.closest('button')
    expect(canvasTrigger).not.toBeNull()
    fireEvent.click(canvasTrigger as HTMLButtonElement)

    await waitFor(() => {
      expect(canvasTrigger?.className).toContain('bg-muted')
    })
    expect(onToggleCanvas).not.toHaveBeenCalled()

    const canvasModeButton = Array.from(container.querySelectorAll('button')).find((button) => (
      button.textContent?.trim() === 'Canvas mode'
    ))
    expect(canvasModeButton).not.toBeNull()
    fireEvent.click(canvasModeButton as HTMLButtonElement)
    expect(onToggleCanvas).toHaveBeenCalledTimes(1)
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

    const settingsTrigger = container.querySelector('svg.lucide-ellipsis-vertical')?.closest('button')
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
      const nextSettingsTrigger = container.querySelector('svg.lucide-ellipsis-vertical')?.closest('button')
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

  it('sends all items to agents from the copy popover', async () => {
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
    fireEvent.click(editsTrigger as HTMLButtonElement)

    const sendAllButton = await waitFor(() => {
      const found = Array.from(document.body.querySelectorAll('button')).find((button) => (
        button.textContent?.trim().toLowerCase().startsWith('send all')
      ))
      expect(found).not.toBeNull()
      return found as HTMLButtonElement
    })

    fireEvent.click(sendAllButton)
    await waitFor(() => {
      expect(onSendAllToAgents).toHaveBeenCalledTimes(1)
    })
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

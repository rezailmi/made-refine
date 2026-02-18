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
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerUp: vi.fn(),
    handlePointerCancel: vi.fn(),
  }),
}))

vi.mock('@base-ui/react/popover', () => ({
  Popover: {
    Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Trigger: React.forwardRef<HTMLButtonElement, { render?: React.ReactElement; children?: React.ReactNode }>(
      ({ render, children }, ref) => {
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
  TooltipTrigger: React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>(
    ({ children, ...props }, ref) => (
      <button ref={ref} type="button" {...props}>{children}</button>
    ),
  ),
  TooltipContent: ({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) => (
    <div {...props}>{children}</div>
  ),
}))

describe('DirectEditToolbarInner', () => {
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
      const found = document.body.querySelector('div[role="button"][tabindex="0"]')
      expect(found).not.toBeNull()
      return found as HTMLDivElement
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
})

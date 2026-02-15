import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DirectEditToolbarInner } from './toolbar'

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
})

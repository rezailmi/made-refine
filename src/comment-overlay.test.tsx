import * as React from 'react'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommentOverlay } from './comment-overlay'
import type { Comment } from './types'

vi.mock('./ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render, children }: { render: React.ReactElement; children?: React.ReactNode }) => (
    React.cloneElement(render, {}, children)
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function createComment(id: string): Comment {
  const element = document.createElement('div')
  element.id = `comment-target-${id}`
  document.body.appendChild(element)

  return {
    id,
    element,
    locator: {
      reactStack: [],
      domSelector: `#${element.id}`,
      domContextHtml: '<div></div>',
      targetHtml: `<div id="${element.id}"></div>`,
      textPreview: 'Increase contrast',
      tagName: 'DIV',
      id: element.id,
      classList: [],
    },
    clickPosition: { x: 10, y: 10 },
    relativePosition: { x: 0, y: 0 },
    text: 'Increase contrast',
    createdAt: Date.now() - 1_000,
    replies: [],
  }
}

describe('CommentOverlay', () => {
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    document.body.innerHTML = ''
  })

  it('shows copy button and exports the active comment', async () => {
    const comment = createComment('c1')
    const onExport = vi.fn().mockResolvedValue(true)

    const { container } = render(
      <CommentOverlay
        comments={[comment]}
        activeCommentId={comment.id}
        onSetActiveComment={() => {}}
        onUpdateText={() => {}}
        onAddReply={() => {}}
        onDelete={() => {}}
        onExport={onExport}
        onSendToAgent={vi.fn().mockResolvedValue(true)}
      />,
    )

    const copyButton = container.querySelector('svg.lucide-copy')?.closest('button')
    expect(copyButton).not.toBeNull()

    fireEvent.click(copyButton as HTMLButtonElement)

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledTimes(1)
    })
  })

  it('hides copy button when export callback is not provided', () => {
    const comment = createComment('c2')

    const { container } = render(
      <CommentOverlay
        comments={[comment]}
        activeCommentId={comment.id}
        onSetActiveComment={() => {}}
        onUpdateText={() => {}}
        onAddReply={() => {}}
        onDelete={() => {}}
        onSendToAgent={vi.fn().mockResolvedValue(true)}
      />,
    )

    expect(container.querySelector('svg.lucide-copy')).toBeNull()
  })

  it('extends copied state when copy is clicked repeatedly', async () => {
    vi.useFakeTimers()
    const comment = createComment('c3')
    const onExport = vi.fn().mockResolvedValue(true)

    const { container } = render(
      <CommentOverlay
        comments={[comment]}
        activeCommentId={comment.id}
        onSetActiveComment={() => {}}
        onUpdateText={() => {}}
        onAddReply={() => {}}
        onDelete={() => {}}
        onExport={onExport}
        onSendToAgent={vi.fn().mockResolvedValue(true)}
      />,
    )

    const copyButton = container.querySelector('svg.lucide-copy')?.closest('button') as HTMLButtonElement
    expect(copyButton).not.toBeNull()

    await act(async () => {
      fireEvent.click(copyButton)
    })
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(copyButton.getAttribute('aria-label')).toBe('Copied')

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    await act(async () => {
      fireEvent.click(copyButton)
    })
    expect(onExport).toHaveBeenCalledTimes(2)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(copyButton.getAttribute('aria-label')).toBe('Copied')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(copyButton.getAttribute('aria-label')).toBe('Copy comment export')
  })
})

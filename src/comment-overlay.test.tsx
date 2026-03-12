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

  it('hides send button when the agent connection is unavailable', () => {
    const comment = createComment('c-send-hidden')

    const { container } = render(
      <CommentOverlay
        comments={[comment]}
        activeCommentId={comment.id}
        onSetActiveComment={() => {}}
        onUpdateText={() => {}}
        onAddReply={() => {}}
        onDelete={() => {}}
        onExport={vi.fn().mockResolvedValue(true)}
      />,
    )

    expect(container.querySelector('svg.lucide-send')).toBeNull()
    expect(container.querySelector('svg.lucide-copy')).not.toBeNull()
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

  it('positions the comment pin at the top-right of the target element', async () => {
    const comment = createComment('c4')
    comment.element.getBoundingClientRect = () => ({
      left: 40,
      top: 60,
      width: 120,
      height: 80,
      right: 160,
      bottom: 140,
      x: 40,
      y: 60,
      toJSON: () => ({}),
    }) as DOMRect

    const { container } = render(
      <CommentOverlay
        comments={[comment]}
        activeCommentId={null}
        onSetActiveComment={() => {}}
        onUpdateText={() => {}}
        onAddReply={() => {}}
        onDelete={() => {}}
        onSendToAgent={vi.fn().mockResolvedValue(true)}
      />,
    )

    await waitFor(() => {
      const pin = container.querySelector('[data-direct-edit="comment-pin"]') as HTMLButtonElement | null
      expect(pin).not.toBeNull()
      expect(pin?.style.left).toBe('154px')
      expect(pin?.style.top).toBe('54px')
    })
  })

  it('uses a multiline reply composer inside the thread card', () => {
    const comment = createComment('c5')

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

    const card = container.querySelector('[data-direct-edit="comment-card"]') as HTMLElement | null
    const replyField = container.querySelector('[data-direct-edit="comment-card"] textarea') as HTMLTextAreaElement | null

    expect(card?.style.width).toBe('280px')
    expect(replyField).not.toBeNull()
    expect(replyField?.placeholder).toBe('Reply...')
    expect(replyField?.rows).toBe(1)
  })

  it('renders the legacy draft input path for empty comments when onUpdateText is provided', async () => {
    const comment = createComment('c-draft')
    comment.text = ''
    const onUpdateText = vi.fn()

    const { container } = render(
      <CommentOverlay
        comments={[comment]}
        activeCommentId={comment.id}
        onSetActiveComment={() => {}}
        onUpdateText={onUpdateText}
        onAddReply={() => {}}
        onDelete={() => {}}
      />,
    )

    const input = container.querySelector('[data-direct-edit="comment-card"] input') as HTMLInputElement | null
    expect(input).not.toBeNull()
    expect(input?.placeholder).toBe('Add a comment...')

    fireEvent.change(input as HTMLInputElement, { target: { value: 'Needs spacing update' } })
    fireEvent.keyDown(input as HTMLInputElement, { key: 'Enter' })

    await waitFor(() => {
      expect(onUpdateText).toHaveBeenCalledWith(comment.id, 'Needs spacing update')
    })
  })

  it('wraps long comment and reply text without horizontal scrolling', () => {
    const comment = createComment('c-wrap')
    comment.text = 'dadjasdhjkadhajddjasdkdjadajdjadajkdaj'
    comment.replies = [
      { text: 'daskdasldjakdjasjdhjjdhjsahdajkshdajkdhajdhasjc', createdAt: Date.now() },
    ]

    const { container } = render(
      <CommentOverlay
        comments={[comment]}
        activeCommentId={comment.id}
        onSetActiveComment={() => {}}
        onUpdateText={() => {}}
        onAddReply={() => {}}
        onDelete={() => {}}
      />,
    )

    const threadBody = container.querySelector('[data-direct-edit="comment-card"] .max-h-48') as HTMLElement | null
    const textBlocks = Array.from(container.querySelectorAll('[data-direct-edit="comment-card"] p')) as HTMLParagraphElement[]

    expect(threadBody?.className).toContain('overflow-x-hidden')
    expect(textBlocks.length).toBeGreaterThanOrEqual(2)
    for (const block of textBlocks) {
      expect(block.className).toContain('whitespace-pre-wrap')
      expect(block.className).toContain('break-words')
      expect(block.className).toContain('[overflow-wrap:anywhere]')
    }
  })
})

import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SelectedCommentComposer } from './selected-comment-composer'
import type { Comment } from '../types'

function createComment(): Comment {
  const element = document.createElement('div')
  document.body.appendChild(element)
  element.getBoundingClientRect = () => ({
    left: 40,
    top: 60,
    width: 180,
    height: 100,
    right: 220,
    bottom: 160,
    x: 40,
    y: 60,
    toJSON: () => ({}),
  }) as DOMRect

  return {
    id: 'comment-selected',
    element,
    locator: {
      reactStack: [],
      domSelector: 'div',
      domContextHtml: '<div></div>',
      targetHtml: '<div></div>',
      textPreview: '',
      tagName: 'div',
      id: null,
      classList: [],
    },
    clickPosition: { x: 50, y: 70 },
    relativePosition: { x: 0.5, y: 0.5 },
    text: '',
    createdAt: Date.now(),
    replies: [],
  }
}

describe('SelectedCommentComposer', () => {
  it('top-aligns the submit button and hides the textarea scrollbar', () => {
    const comment = createComment()
    const { container } = render(
      <SelectedCommentComposer
        comment={comment}
        attentionNonce={0}
        onSubmit={() => null}
        onCancel={() => {}}
      />,
    )

    const composer = container.querySelector('[data-direct-edit="selected-comment-composer"]') as HTMLElement | null
    const textarea = container.querySelector('[data-direct-edit="selected-comment-composer"] textarea') as HTMLTextAreaElement | null
    const button = container.querySelector('[data-direct-edit="selected-comment-composer"] button') as HTMLButtonElement | null

    expect(composer?.className).toContain('items-start')
    expect(composer?.style.width).toBe('200px')
    expect(composer?.style.top).toBe('188px')
    expect(textarea?.className).toContain('overflow-hidden')
    expect(textarea?.className).toContain('py-1.5')
    expect(textarea?.style.scrollbarWidth).toBe('none')
    expect(textarea?.getAttribute('style')).toContain('scrollbar-width: none;')
    expect(button?.className).toContain('self-start')
  })
})

import * as React from 'react'
import { ArrowUp } from 'lucide-react'
import type { Comment } from '../types'
import { copyText } from '../clipboard'
import { useAutosizeTextarea } from '../hooks/use-autosize-textarea'
import { useViewportEvents } from '../hooks/use-viewport-events'
import { cn } from '../cn'
import { Button } from '../ui/button'

const VIEWPORT_INSET = 12
const COMPOSER_MIN_WIDTH = 200
const COMPOSER_WIDTH = 200
const DIMENSION_LABEL_OFFSET = 4
const DIMENSION_LABEL_HEIGHT = 20
const COMPOSER_TOP_GAP = 4
const COMPOSER_APPROX_HEIGHT = 60
const TOOLBAR_COLLISION_GAP = 12

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

interface ComposerPosition {
  left: number
  top: number
  width: number
}

function getToolbarRect(): DOMRect | null {
  const host = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
  const toolbar = host?.shadowRoot?.querySelector('[data-direct-edit="toolbar"]') as HTMLElement | null
  if (!toolbar) return null
  return toolbar.getBoundingClientRect()
}

function rectsOverlap(a: { left: number; top: number; width: number; height: number }, b: DOMRect): boolean {
  return (
    a.left < b.right
    && a.left + a.width > b.left
    && a.top < b.bottom
    && a.top + a.height > b.top
  )
}

function getComposerPosition(element: HTMLElement, composerHeight = COMPOSER_APPROX_HEIGHT): ComposerPosition | null {
  if (!element.isConnected) return null

  const rect = element.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const maxWidth = Math.max(COMPOSER_MIN_WIDTH, viewportWidth - VIEWPORT_INSET * 2)
  const targetWidth = clamp(
    COMPOSER_WIDTH,
    COMPOSER_MIN_WIDTH,
    Math.min(COMPOSER_WIDTH, maxWidth),
  )
  const targetTop = rect.top + rect.height + DIMENSION_LABEL_OFFSET + DIMENSION_LABEL_HEIGHT + COMPOSER_TOP_GAP
  const maxTop = viewportHeight - composerHeight - VIEWPORT_INSET
  const left = clamp(
    rect.left + rect.width / 2 - targetWidth / 2,
    VIEWPORT_INSET,
    viewportWidth - targetWidth - VIEWPORT_INSET,
  )
  let top = clamp(targetTop, VIEWPORT_INSET, maxTop)
  const toolbarRect = getToolbarRect()

  if (toolbarRect) {
    const composerRect = {
      left,
      top,
      width: targetWidth,
      height: composerHeight,
    }
    if (rectsOverlap(composerRect, toolbarRect)) {
      const belowToolbarTop = toolbarRect.bottom + TOOLBAR_COLLISION_GAP
      if (belowToolbarTop <= maxTop) {
        top = Math.max(top, belowToolbarTop)
      } else {
        top = clamp(toolbarRect.top - composerHeight - TOOLBAR_COLLISION_GAP, VIEWPORT_INSET, maxTop)
      }
    }
  }

  return {
    width: targetWidth,
    left,
    top,
  }
}

export interface SelectedCommentComposerProps {
  comment: Comment
  attentionNonce: number
  draftRef?: React.MutableRefObject<string>
  onDraftTextChange?: (text: string) => void
  onSubmit: (text: string) => string | null
  onCancel: () => void
}

export function SelectedCommentComposer({
  comment,
  attentionNonce,
  draftRef,
  onDraftTextChange,
  onSubmit,
  onCancel,
}: SelectedCommentComposerProps) {
  const [text, setText] = React.useState(() => draftRef?.current ?? '')
  const [showError, setShowError] = React.useState(false)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const [position, setPosition] = React.useState<ComposerPosition | null>(() => getComposerPosition(comment.element))

  useAutosizeTextarea(inputRef, text, 3)

  const updatePosition = React.useCallback(() => {
    const measuredHeight = cardRef.current?.getBoundingClientRect().height
    setPosition(getComposerPosition(comment.element, measuredHeight ?? COMPOSER_APPROX_HEIGHT))
  }, [comment.element])

  useViewportEvents(updatePosition)

  React.useLayoutEffect(() => {
    updatePosition()
  }, [updatePosition])

  React.useLayoutEffect(() => {
    updatePosition()
  }, [text, updatePosition])

  const handleComposerClick = React.useCallback(() => {
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    setText(draftRef?.current ?? comment.text)
  }, [comment.id, comment.text, draftRef])

  React.useEffect(() => {
    if (attentionNonce <= 0) return
    setShowError(true)
    cardRef.current?.animate?.(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 260, easing: 'ease-in-out' },
    )
    const timeout = window.setTimeout(() => setShowError(false), 420)
    return () => window.clearTimeout(timeout)
  }, [attentionNonce])

  React.useEffect(() => {
    if (draftRef) draftRef.current = text
    onDraftTextChange?.(text)
  }, [draftRef, onDraftTextChange, text])

  const submit = React.useCallback(() => {
    const nextText = text.trim()
    if (!nextText) return
    const exportText = onSubmit(nextText)
    if (exportText) {
      void copyText(exportText)
    }
  }, [onSubmit, text])

  if (!position) return null

  return (
    <div
      ref={cardRef}
      role="presentation"
      data-direct-edit="selected-comment-composer"
      className={cn(
        'fixed z-[99999] flex items-start gap-2 rounded-xl outline outline-1 outline-foreground/10 bg-background p-1.5 shadow-lg',
        showError && 'outline-red-500/70'
      )}
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        pointerEvents: 'auto',
      }}
      onClick={(e) => { e.stopPropagation(); handleComposerClick() }}
    >
      <textarea
        ref={inputRef}
        rows={1}
        autoFocus
        aria-invalid={showError}
        className={cn(
          'min-h-[18px] min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-1.5 py-1.5 text-xs leading-[18px] text-foreground placeholder:text-muted-foreground focus:outline-none',
          showError && 'placeholder:text-red-400'
        )}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        placeholder="Add a comment..."
        value={text}
        onChange={(e) => {
          setText(e.target.value)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') {
            onCancel()
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-7 shrink-0 self-start',
          text.trim()
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-muted text-muted-foreground'
        )}
        disabled={!text.trim()}
        onClick={submit}
      >
        <ArrowUp />
      </Button>
    </div>
  )
}

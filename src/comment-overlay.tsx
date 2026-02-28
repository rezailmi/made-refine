import * as React from 'react'
import type { Comment, ElementLocator } from './types'
import { useViewportEvents } from './hooks/use-viewport-events'
import { cn } from './cn'
import { Button } from './ui/button'
import { ChevronLeft, Check, Copy, Trash2, ArrowUp, Send, X } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip'

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function ElementLabel({ locator }: { locator: ElementLocator }) {
  return (
    <span className="truncate text-[10px] text-muted-foreground">
      <code className="font-medium">&lt;{locator.tagName.toLowerCase()}&gt;</code>
      {locator.id && <span>#{locator.id}</span>}
      {!locator.id && locator.classList.length > 0 && (
        <span>.{locator.classList.slice(0, 2).join('.')}{locator.classList.length > 2 ? `\u2026` : ''}</span>
      )}
    </span>
  )
}

export interface CommentOverlayProps {
  comments: Comment[]
  activeCommentId: string | null
  onSetActiveComment: (id: string | null) => void
  onUpdateText: (id: string, text: string) => void
  onAddReply: (id: string, text: string) => void
  onDelete: (id: string) => void
  onExport?: (id: string) => Promise<boolean>
  onSendToAgent: (id: string) => Promise<boolean>
  attentionRequest?: { commentId: string; nonce: number } | null
  draftRef?: React.MutableRefObject<string>
}

export function CommentOverlay({
  comments,
  activeCommentId,
  onSetActiveComment,
  onUpdateText,
  onAddReply,
  onDelete,
  onExport,
  onSendToAgent,
  attentionRequest = null,
  draftRef,
}: CommentOverlayProps) {
  if (comments.length === 0) return null

  return (
    <>
      {comments.map((comment, index) => (
        <CommentPin
          key={comment.id}
          comment={comment}
          index={index + 1}
          isActive={activeCommentId === comment.id}
          onActivate={() => onSetActiveComment(comment.id)}
          onClose={() => onSetActiveComment(null)}
          onUpdateText={(text) => onUpdateText(comment.id, text)}
          onAddReply={(text) => onAddReply(comment.id, text)}
          onDelete={() => onDelete(comment.id)}
          onExport={onExport ? () => onExport(comment.id) : undefined}
          onSendToAgent={() => onSendToAgent(comment.id)}
          attentionNonce={attentionRequest?.commentId === comment.id ? attentionRequest.nonce : 0}
          draftRef={activeCommentId === comment.id ? draftRef : undefined}
        />
      ))}
    </>
  )
}

interface CommentPinProps {
  comment: Comment
  index: number
  isActive: boolean
  onActivate: () => void
  onClose: () => void
  onUpdateText: (text: string) => void
  onAddReply: (text: string) => void
  onDelete: () => void
  onExport?: () => Promise<boolean>
  onSendToAgent: () => Promise<boolean>
  attentionNonce: number
  draftRef?: React.MutableRefObject<string>
}

function CommentPin({
  comment,
  index,
  isActive,
  onActivate,
  onClose,
  onUpdateText,
  onAddReply,
  onDelete,
  onExport,
  onSendToAgent,
  attentionNonce,
  draftRef,
}: CommentPinProps) {
  const [position, setPosition] = React.useState(comment.clickPosition)
  const [elementRect, setElementRect] = React.useState<DOMRect | null>(null)
  const [flipHorizontal, setFlipHorizontal] = React.useState(false)
  const [flipVertical, setFlipVertical] = React.useState(false)

  const updatePosition = React.useCallback(() => {
    if (!comment.element.isConnected) return
    const rect = comment.element.getBoundingClientRect()
    const relativeX = clampUnit(comment.relativePosition.x)
    const relativeY = clampUnit(comment.relativePosition.y)
    setPosition({
      x: rect.left + relativeX * rect.width,
      y: rect.top + relativeY * rect.height,
    })
    setElementRect(rect)
  }, [comment.element, comment.relativePosition])

  useViewportEvents(updatePosition)

  React.useEffect(() => {
    updatePosition()
  }, [updatePosition])

  React.useEffect(() => {
    if (isActive) {
      const hasText = comment.text !== ''
      const cardWidth = hasText ? 280 : 220
      const cardHeight = hasText ? 220 : 40
      const pinSize = 12
      setFlipHorizontal(position.x + pinSize + cardWidth > window.innerWidth)
      setFlipVertical(position.y + cardHeight > window.innerHeight)
    }
  }, [isActive, position, comment.text])

  return (
    <>
      {isActive && elementRect && (
        <svg
          data-direct-edit="comment-highlight"
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 99997,
          }}
        >
          <rect
            x={elementRect.left}
            y={elementRect.top}
            width={elementRect.width}
            height={elementRect.height}
            fill="rgba(59, 130, 246, 0.06)"
            stroke="#3B82F6"
            strokeWidth={1}
          />
        </svg>
      )}

      <button
        type="button"
        data-direct-edit="comment-pin"
        aria-label={`Comment ${index}`}
        className="group/pin fixed z-[99998] flex size-3 cursor-pointer items-center justify-center rounded-full border-none bg-blue-500 p-0 shadow-md ring-2 ring-white transition-transform hover:scale-[1.67] hover:shadow-lg"
        style={{
          left: position.x - 6,
          top: position.y - 6,
          pointerEvents: 'auto',
        }}
        onClick={(e) => {
          e.stopPropagation()
          onActivate()
        }}
      >
        <span className="hidden text-[7px] font-medium leading-none text-white group-hover/pin:inline">
          {index}
        </span>
      </button>

      {isActive && (
        comment.text === '' ? (
          <NewCommentInput
            position={position}
            flipHorizontal={flipHorizontal}
            flipVertical={flipVertical}
            onSubmit={(text) => {
              onUpdateText(text)
            }}
            onCancel={onClose}
            attentionNonce={attentionNonce}
            draftRef={draftRef}
          />
        ) : (
          <CommentThread
            comment={comment}
            index={index}
            position={position}
            flipHorizontal={flipHorizontal}
            flipVertical={flipVertical}
            onClose={onClose}
            onAddReply={(text) => {
              onAddReply(text)
            }}
            onDelete={onDelete}
            onExport={onExport}
            onSendToAgent={onSendToAgent}
          />
        )
      )}
    </>
  )
}

interface NewCommentInputProps {
  position: { x: number; y: number }
  flipHorizontal: boolean
  flipVertical: boolean
  onSubmit: (text: string) => void
  onCancel: () => void
  attentionNonce: number
  draftRef?: React.MutableRefObject<string>
}

function NewCommentInput({
  position,
  flipHorizontal,
  flipVertical,
  onSubmit,
  onCancel,
  attentionNonce,
  draftRef,
}: NewCommentInputProps) {
  const [text, setText] = React.useState('')
  const [showError, setShowError] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const cardRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
      { duration: 260, easing: 'ease-in-out' }
    )
    const timeout = window.setTimeout(() => setShowError(false), 420)
    return () => window.clearTimeout(timeout)
  }, [attentionNonce])

  return (
    <div
      ref={cardRef}
      role="presentation"
      data-direct-edit="comment-card"
      className={cn(
        'fixed z-[99999] flex items-center gap-2 rounded-xl outline outline-1 outline-foreground/10 bg-background p-1.5 shadow-lg',
        showError && 'outline-red-500/70'
      )}
      style={{
        width: 220,
        left: flipHorizontal ? position.x - 220 - 8 : position.x + 14,
        top: flipVertical ? position.y - 40 : position.y - 18,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        aria-invalid={showError}
        className={cn(
          'min-w-0 flex-1 bg-transparent px-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none',
          showError && 'placeholder:text-red-400'
        )}
        placeholder="Add a comment..."
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (draftRef) draftRef.current = e.target.value
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' && text.trim()) {
            onSubmit(text.trim())
          } else if (e.key === 'Escape') {
            onCancel()
          }
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'size-7 shrink-0',
          text.trim()
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-muted text-muted-foreground'
        )}
        disabled={!text.trim()}
        onClick={() => {
          if (text.trim()) onSubmit(text.trim())
        }}
      >
        <ArrowUp />
      </Button>
    </div>
  )
}

interface CommentThreadProps {
  comment: Comment
  index: number
  position: { x: number; y: number }
  flipHorizontal: boolean
  flipVertical: boolean
  onClose: () => void
  onAddReply: (text: string) => void
  onDelete: () => void
  onExport?: () => Promise<boolean>
  onSendToAgent: () => Promise<boolean>
}

function CommentThread({
  comment,
  index,
  position,
  flipHorizontal,
  flipVertical,
  onClose,
  onAddReply,
  onDelete,
  onExport,
  onSendToAgent,
}: CommentThreadProps) {
  const [replyText, setReplyText] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  const [sendStatus, setSendStatus] = React.useState<'idle' | 'sending' | 'sent' | 'offline'>('idle')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const copyTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    if (!onExport) return
    const success = await onExport()
    if (success) {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current)
      }
      setCopied(true)
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null
        setCopied(false)
      }, 2000)
    }
  }

  const handleSendToAgent = async () => {
    if (sendStatus === 'sending') return
    setSendStatus('sending')
    const success = await onSendToAgent()
    if (success) {
      setSendStatus('sent')
      setTimeout(() => setSendStatus('idle'), 2000)
    } else {
      setSendStatus('offline')
      setTimeout(() => setSendStatus('idle'), 2000)
    }
  }

  const handleSubmitReply = () => {
    if (replyText.trim()) {
      onAddReply(replyText.trim())
      setReplyText('')
    }
  }

  return (
    <div
      role="presentation"
      data-direct-edit="comment-card"
      className="fixed z-[99999] w-[280px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background shadow-lg"
      style={{
        left: flipHorizontal ? position.x - 280 - 8 : position.x + 14,
        top: flipVertical ? position.y - 220 : position.y - 14,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <TooltipProvider delayDuration={300} closeDelay={0}>
        <div className="flex items-center justify-between border-b border-border/50 px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={onClose}
                  />
                }
              >
                <ChevronLeft />
              </TooltipTrigger>
              <TooltipContent side="bottom">Back</TooltipContent>
            </Tooltip>
            <ElementLabel locator={comment.locator} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onExport && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={copied ? 'Copied' : 'Copy comment export'}
                      className="size-7 text-muted-foreground"
                      onClick={handleCopy}
                    />
                  }
                >
                  {copied ? (
                    <Check className="text-green-500" />
                  ) : (
                    <Copy />
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom">{copied ? 'Copied' : 'Copy'}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={handleSendToAgent}
                  />
                }
              >
                {sendStatus === 'sent' ? (
                  <Check className="text-green-500" />
                ) : sendStatus === 'offline' ? (
                  <X className="text-red-500" />
                ) : (
                  <Send />
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {sendStatus === 'sent' ? 'Sent' : sendStatus === 'offline' ? 'Offline' : 'Send to Agent'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={onDelete}
                  />
                }
              >
                <Trash2 />
              </TooltipTrigger>
              <TooltipContent side="bottom">Delete</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>

      {/* Thread body */}
      <div className="max-h-48 overflow-y-auto">
        {/* Original comment */}
        <div className="px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-2">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
              {index}
            </div>
            <span className="text-xs font-medium text-foreground">Comment #{index}</span>
            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
          </div>
          <p className="text-xs leading-relaxed text-foreground">{comment.text}</p>
        </div>

        {/* Replies */}
        {comment.replies.map((reply) => (
          <div key={reply.createdAt} className="border-t border-border/30 px-3 py-2.5">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {index}
              </div>
              <span className="text-[10px] text-muted-foreground">{formatRelativeTime(reply.createdAt)}</span>
            </div>
            <p className="text-xs leading-relaxed text-foreground">{reply.text}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-border/50 px-2 py-1.5">
        <input
          ref={inputRef}
          type="text"
          className="min-w-0 flex-1 bg-transparent px-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder="Reply..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') {
              handleSubmitReply()
            } else if (e.key === 'Escape') {
              onClose()
            }
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-7 shrink-0',
            replyText.trim()
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-muted text-muted-foreground'
          )}
          disabled={!replyText.trim()}
          onClick={handleSubmitReply}
        >
          <ArrowUp />
        </Button>
      </div>
    </div>
  )
}

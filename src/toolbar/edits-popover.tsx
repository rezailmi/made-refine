import * as React from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { usePortalContainer } from '../portal-container'
import { Popover } from '@base-ui/react/popover'
import { X, Check, Copy, Send, Trash2 } from 'lucide-react'
import type { SessionItem, SessionEdit, MoveIntent } from '../types'
import { Badge } from '../ui/badge'
import {
  buildSessionExport,
  buildExportInstruction,
  getExportContentProfile,
  buildMovePlanContext,
  getMoveIntentForEdit,
} from '../utils'
import { copyText } from '../clipboard'
import { cn } from '../cn'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../ui/tooltip'
import { toolbarBtnClass } from './shared'

function EditsPopoverPortal(props: React.ComponentPropsWithoutRef<typeof Popover.Portal>) {
  const container = usePortalContainer()
  return <Popover.Portal container={container} {...props} />
}

function truncateText(value: string, max = 64): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function summarizeMoveForPreview(intent: MoveIntent): string {
  const system = intent.layoutPrescription?.recommendedSystem
  const systemPart = system ? `, ${system}` : ''
  return `${intent.operationId}: ${intent.classification}${systemPart}`
}

export interface EditsPopoverProps {
  tooltipSide: 'top' | 'bottom' | 'left' | 'right'
  sessionEditCount: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onGetSessionItems?: () => SessionItem[]
  onExportAllEdits?: () => Promise<boolean>
  onSendAllToAgents?: () => Promise<boolean>
  onClearSessionEdits?: () => void
  onRemoveSessionEdit?: (element: HTMLElement) => void
  onDeleteComment?: (id: string) => void
}

export function EditsPopover({
  tooltipSide,
  sessionEditCount,
  isOpen,
  onOpenChange,
  onGetSessionItems,
  onExportAllEdits,
  onSendAllToAgents,
  onClearSessionEdits,
  onRemoveSessionEdit,
  onDeleteComment,
}: EditsPopoverProps) {
  const [copied, setCopied] = React.useState(false)
  const [sendStatus, setSendStatus] = React.useState<'idle' | 'sending' | 'sent' | 'offline'>('idle')
  const editsPopupRef = React.useRef<HTMLDivElement>(null)
  const editsTriggerRef = React.useRef<HTMLButtonElement>(null)
  const [editsSnapshot, setEditsSnapshot] = React.useState<SessionItem[]>([])
  const movePlanContext = React.useMemo(() => {
    const edits = editsSnapshot
      .filter((item): item is { type: 'edit'; edit: SessionEdit } => item.type === 'edit')
      .map((item) => item.edit)
    return buildMovePlanContext(edits)
  }, [editsSnapshot])
  const visibleItems = React.useMemo(() => {
    return editsSnapshot.filter((item) => {
      if (item.type === 'comment') return true
      if (!item.edit.move) return true
      const moveIntent = getMoveIntentForEdit(item.edit, movePlanContext)
      const hasStyleOrText = Object.keys(item.edit.pendingStyles).length > 0 || item.edit.textEdit != null
      return Boolean(moveIntent || hasStyleOrText)
    })
  }, [editsSnapshot, movePlanContext])

  // Close on outside click (Shadow DOM breaks base-ui's dismiss)
  React.useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(e: PointerEvent) {
      const path = e.composedPath()
      if (editsPopupRef.current && path.includes(editsPopupRef.current)) return
      if (editsTriggerRef.current && path.includes(editsTriggerRef.current)) return
      onOpenChange(false)
    }

    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, onOpenChange])

  // Refresh snapshot when popover opens
  React.useEffect(() => {
    if (isOpen && onGetSessionItems) {
      setEditsSnapshot(onGetSessionItems())
    }
  }, [isOpen, onGetSessionItems])

  const handleCopyAll = React.useCallback(async () => {
    const success = await onExportAllEdits?.()
    if (!success) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [onExportAllEdits])

  const handleSendAll = React.useCallback(async () => {
    if (!onSendAllToAgents || sendStatus === 'sending') return

    setSendStatus('sending')
    let success = false
    try {
      success = await onSendAllToAgents()
    } catch {
      success = false
    }
    if (success) {
      setSendStatus('sent')
      window.setTimeout(() => setSendStatus('idle'), 2000)
      return
    }

    setSendStatus('offline')
    window.setTimeout(() => setSendStatus('idle'), 2000)
  }, [onSendAllToAgents, sendStatus])

  const handleCopyItem = React.useCallback(async (item: SessionItem) => {
    const text = item.type === 'edit'
      ? buildSessionExport([item.edit], [], {
          movePlanContext,
          includeMovePlanHeader: false,
        })
      : buildSessionExport([], [item.comment])
    const instruction = item.type === 'edit'
      ? buildExportInstruction(getExportContentProfile(
          [item.edit],
          [],
          item.edit.move ? buildMovePlanContext([item.edit]) : null,
        ))
      : buildExportInstruction({ hasCssEdits: false, hasTextEdits: false, hasMoves: false, hasComments: true })
    const success = await copyText(`${instruction}\n\n${text}`)
    if (!success) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [movePlanContext])

  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Tooltip disabled={isOpen}>
        <TooltipTrigger render={
          <Popover.Trigger render={
            <button
              ref={editsTriggerRef}
              type="button"
              className={cn(
                toolbarBtnClass,
                sessionEditCount > 0 || isOpen
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onOpenChange(!isOpen)
              }}
            />
          } />
        }>
          <Copy className="size-4" />
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          <span>Export edits</span>
        </TooltipContent>
      </Tooltip>
      <EditsPopoverPortal>
        <Popover.Positioner side={tooltipSide} sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
          <Popover.Popup
            ref={editsPopupRef}
            className="w-[340px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
              <span className="text-xs font-medium text-foreground">Copy to AI agents</span>
              {visibleItems.length > 0 && (
                <div className="flex items-center gap-1">
                  <BaseButton
                    className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      void handleCopyAll()
                    }}
                  >
                    {copied ? (
                      <Check className="size-3 text-green-400" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copied ? 'Copied' : 'Copy all'}
                  </BaseButton>
                  {onSendAllToAgents && (
                    <BaseButton
                      className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        void handleSendAll()
                      }}
                      disabled={sendStatus === 'sending'}
                    >
                      {sendStatus === 'offline' ? (
                        <X className="size-3 text-red-500" />
                      ) : sendStatus === 'sent' ? (
                        <Check className="size-3 text-green-400" />
                      ) : (
                        <Send className={cn('size-3', sendStatus === 'sending' && 'animate-pulse')} />
                      )}
                      {sendStatus === 'sending'
                        ? 'Sending'
                        : sendStatus === 'sent'
                          ? 'Sent'
                          : sendStatus === 'offline'
                            ? 'Offline'
                            : 'Send all'}
                    </BaseButton>
                  )}
                  <Tooltip>
                    <TooltipTrigger render={
                      <BaseButton
                        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => {
                          onClearSessionEdits?.()
                          setEditsSnapshot([])
                        }}
                      />
                    }>
                      <Trash2 className="size-3" />
                    </TooltipTrigger>
                    <TooltipContent side={tooltipSide}>
                      <span>Clear all</span>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
            {visibleItems.length === 0 ? (
              <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground">
                No edits or comments yet.
              </div>
            ) : (
              <div className="max-h-[240px] overflow-y-auto px-1 py-1">
                {visibleItems.map((item, i) => {
                  const isEdit = item.type === 'edit'
                  const moveIntent = isEdit && item.edit.move ? getMoveIntentForEdit(item.edit, movePlanContext) : null
                  const isMoved = Boolean(moveIntent)
                  const locator = isEdit ? item.edit.locator : item.comment.locator
                  const componentName = locator.reactStack[0]?.name ?? locator.tagName
                  let valueSummary = ''
                  if (isEdit) {
                    const entries = Object.entries(item.edit.pendingStyles)
                    const editValues: string[] = []
                    for (const [prop, value] of entries) {
                      editValues.push(`${prop}: ${value}`)
                    }
                    if (item.edit.textEdit) {
                      editValues.push(`text: "${item.edit.textEdit.newText}"`)
                    }
                    if (moveIntent) {
                      editValues.push(summarizeMoveForPreview(moveIntent))
                    }
                    valueSummary = editValues.length > 0 ? editValues.join(', ') : '(no edits)'
                  } else {
                    const commentValues: string[] = []
                    commentValues.push(item.comment.text.trim() ? item.comment.text.trim() : '(empty)')
                    for (const reply of item.comment.replies.slice(0, 2)) {
                      commentValues.push(`reply: ${reply.text}`)
                    }
                    valueSummary = commentValues.join(', ')
                  }
                  return (
                    <div
                      key={item.type === 'comment' ? item.comment.id : `edit-${i}`}
                      role="button"
                      tabIndex={0}
                      className="group flex cursor-pointer items-start justify-between rounded-md px-1.5 py-1.5 text-xs transition-colors hover:bg-muted/50"
                      onClick={() => {
                        void handleCopyItem(item)
                      }}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          void handleCopyItem(item)
                        }
                      }}
                    >
                      <div className="min-w-0 flex flex-1 flex-col items-start gap-[4px]">
                        <Badge variant="secondary" className="h-6 shrink-0 px-1.5 text-xs">
                          @&lt;{componentName}&gt;
                        </Badge>
                        <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
                          {isEdit ? (isMoved ? 'moved: ' : 'edit: ') : 'comment: '}
                          {truncateText(valueSummary, 128)}
                        </span>
                      </div>
                      <BaseButton
                        className="ml-2 flex size-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color,color] hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (item.type === 'edit') {
                            onRemoveSessionEdit?.(item.edit.element)
                          } else {
                            onDeleteComment?.(item.comment.id)
                          }
                          setEditsSnapshot((prev) => prev.filter((candidate) => {
                            if (item.type === 'edit' && candidate.type === 'edit') {
                              return candidate.edit.element !== item.edit.element
                            }
                            if (item.type === 'comment' && candidate.type === 'comment') {
                              return candidate.comment.id !== item.comment.id
                            }
                            return true
                          }))
                        }}
                      >
                        <X className="size-3" />
                      </BaseButton>
                    </div>
                  )
                })}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </EditsPopoverPortal>
    </Popover.Root>
  )
}

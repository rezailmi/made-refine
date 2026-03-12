import * as React from 'react'
import { Button } from '../ui/button'
import { Tip } from './shared'
import { cn } from '../cn'
import { X, Copy, Check, Send } from 'lucide-react'

const panelBarBaseClass = 'flex h-11 shrink-0 items-center border-border/50 bg-background px-3'

export interface PanelFooterProps {
  isDraggable: boolean
  canTriggerSend: boolean
  onExportEdits?: () => Promise<boolean>
  onSendToAgent?: () => Promise<boolean>
  showSendButton?: boolean
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
  onPointerCancel?: (e: React.PointerEvent) => void
}

export function PanelFooter({
  isDraggable,
  canTriggerSend,
  onExportEdits,
  onSendToAgent,
  showSendButton = true,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: PanelFooterProps) {
  const [copied, setCopied] = React.useState(false)
  const [copyError, setCopyError] = React.useState(false)
  const [sendStatus, setSendStatus] = React.useState<'idle' | 'sending' | 'sent' | 'offline'>('idle')

  const handleCopy = async () => {
    if (!onExportEdits) return
    const success = await onExportEdits()
    if (success) {
      setCopyError(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    }
    setCopied(false)
    setCopyError(true)
    setTimeout(() => setCopyError(false), 2000)
  }

  const handleSendToAgent = async () => {
    if (!onSendToAgent || sendStatus === 'sending') return
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

  return (
    <div
      className={cn(
        panelBarBaseClass,
        'gap-1 border-t',
        isDraggable && 'cursor-grab active:cursor-grabbing',
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="flex-1" />
      {onExportEdits && (
        <Tip label="Copy edits">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            aria-label={copyError ? 'Copy failed' : copied ? 'Copied' : 'Copy edits'}
            className="size-7"
          >
            {copyError ? (
              <X className="text-red-500" />
            ) : copied ? (
              <Check className="text-green-500" />
            ) : (
              <Copy />
            )}
          </Button>
        </Tip>
      )}
      {showSendButton && onSendToAgent && (
        <span className={!canTriggerSend || sendStatus === 'sending' ? 'cursor-not-allowed' : undefined}>
          <Tip label="Apply changes via agent">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSendToAgent}
              disabled={!canTriggerSend || sendStatus === 'sending'}
              aria-label={sendStatus === 'offline' ? 'Send failed' : sendStatus === 'sent' ? 'Changes sent' : 'Apply changes via agent'}
              className="size-7"
            >
              {sendStatus === 'offline' ? (
                <X className="text-red-500" />
              ) : sendStatus === 'sent' ? (
                <Check className="text-green-500" />
              ) : sendStatus === 'sending' ? (
                <Send className="animate-pulse" />
              ) : (
                <Send />
              )}
            </Button>
          </Tip>
        </span>
      )}
    </div>
  )
}

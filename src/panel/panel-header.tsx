import * as React from 'react'
import { Button } from '../ui/button'
import { Tip } from './shared'
import { cn } from '../cn'
import { X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'

const panelBarBaseClass = 'flex h-11 shrink-0 items-center border-border/50 bg-background px-3'

export interface PanelHeaderProps {
  elementInfo: {
    tagName: string
    id: string | null
    parentElement: HTMLElement | null | boolean
    hasChildren: boolean
  }
  isDraggable: boolean
  onClose?: () => void
  onDelete?: () => void
  onSelectParent?: () => void
  onSelectChild?: () => void
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
  onPointerCancel?: (e: React.PointerEvent) => void
}

export function PanelHeader({
  elementInfo,
  isDraggable,
  onClose,
  onDelete,
  onSelectParent,
  onSelectChild,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        panelBarBaseClass,
        'gap-2 border-b',
        isDraggable && 'cursor-grab active:cursor-grabbing'
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="min-w-0 flex-1">
        <code className="text-xs font-medium text-foreground">
          &lt;{elementInfo.tagName}&gt;
        </code>
        {elementInfo.id && (
          <span className="ml-1.5 text-xs text-muted-foreground">#{elementInfo.id}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onSelectParent && (
          <span className={!elementInfo.parentElement ? 'cursor-not-allowed' : undefined}>
            <Tip label="Select Parent">
              <Button
                variant="ghost"
                size="icon"
                onClick={onSelectParent}
                disabled={!elementInfo.parentElement}
                aria-label="Select parent element"
                className="size-7"
              >
                <ChevronUp />
              </Button>
            </Tip>
          </span>
        )}
        {onSelectChild && (
          <span className={!elementInfo.hasChildren ? 'cursor-not-allowed' : undefined}>
            <Tip label="Select Child">
              <Button
                variant="ghost"
                size="icon"
                onClick={onSelectChild}
                disabled={!elementInfo.hasChildren}
                aria-label="Select child element"
                className="size-7"
              >
                <ChevronDown />
              </Button>
            </Tip>
          </span>
        )}
        {onDelete && (
          <Tip label="Delete Element">
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label="Delete selected element"
              className="size-7 text-destructive hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </Tip>
        )}
        {onClose && (
          <>
            <div className="mx-0.5 h-4 w-px bg-border" />
            <Button variant="ghost" size="icon" aria-label="Close panel" className="size-7" onClick={onClose}>
              <X />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

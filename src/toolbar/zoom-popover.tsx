import * as React from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { usePortalContainer } from '../portal-container'
import { Popover } from '@base-ui/react/popover'
import { Scan, Minimize2, Maximize2, Check, ArrowBigUp } from 'lucide-react'
import { cn } from '../cn'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { toolbarBtnClass } from './shared'

function ZoomPopoverPortal(props: React.ComponentPropsWithoutRef<typeof Popover.Portal>) {
  const container = usePortalContainer()
  return <Popover.Portal container={container} {...props} />
}

export interface ZoomPopoverProps {
  tooltipSide: 'top' | 'bottom' | 'left' | 'right'
  canvasActive: boolean
  canvasZoom: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onToggleCanvas?: () => void
  onSetCanvasZoom?: (zoom: number) => void
  onZoomTo100?: () => void
  onFitToViewport?: () => void
}

export function ZoomPopover({
  tooltipSide,
  canvasActive,
  canvasZoom,
  isOpen,
  onOpenChange,
  onToggleCanvas,
  onSetCanvasZoom,
  onZoomTo100,
  onFitToViewport,
}: ZoomPopoverProps) {
  const popupRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const kbdClass = 'inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground min-w-[20px] min-h-[18px]'

  // Close on outside click (Shadow DOM breaks base-ui's dismiss)
  React.useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(e: PointerEvent) {
      const path = e.composedPath()
      if (popupRef.current && path.includes(popupRef.current)) return
      if (triggerRef.current && path.includes(triggerRef.current)) return
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

  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Tooltip disabled={isOpen}>
        <TooltipTrigger render={
          <Popover.Trigger render={
            <button
              ref={triggerRef}
              type="button"
              className={cn(
                toolbarBtnClass,
                isOpen
                  ? 'bg-muted text-foreground'
                  : canvasActive
                    ? 'bg-muted text-foreground hover:bg-muted/80'
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
          <Maximize2 className="size-4" />
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="inline-flex items-center gap-1.5">
          <span>Canvas mode</span>
          <kbd className={kbdClass}><ArrowBigUp className="size-2.5" /></kbd>
          <kbd className={kbdClass}>Z</kbd>
        </TooltipContent>
      </Tooltip>
      <ZoomPopoverPortal>
        <Popover.Positioner side={tooltipSide} sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
          <Popover.Popup
            ref={popupRef}
            className="w-[180px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          >
            <div className="px-1 py-1">
              <BaseButton
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                onClick={() => {
                  onZoomTo100?.()
                  onOpenChange(false)
                }}
              >
                <Scan className="size-3.5" />
                Actual size (100%)
              </BaseButton>
              <BaseButton
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                onClick={() => {
                  onFitToViewport?.()
                  onOpenChange(false)
                }}
              >
                <Minimize2 className="size-3.5" />
                Fit to viewport
              </BaseButton>
              <div className="my-1 border-t border-foreground/10" />
              <BaseButton
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                onClick={() => {
                  onToggleCanvas?.()
                  onOpenChange(false)
                }}
              >
                <Check className={cn('size-3.5', canvasActive ? 'opacity-100' : 'opacity-0')} />
                Canvas mode
              </BaseButton>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </ZoomPopoverPortal>
    </Popover.Root>
  )
}

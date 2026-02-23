import * as React from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { usePortalContainer } from '../portal-container'
import { Popover } from '@base-ui/react/popover'
import { ZoomIn, ZoomOut, Scan, Minimize2, Maximize2, Check } from 'lucide-react'
import { cn } from '../cn'

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

  // Close popover when canvas is deactivated
  React.useEffect(() => {
    if (!canvasActive) onOpenChange(false)
  }, [canvasActive, onOpenChange])

  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger ref={triggerRef} render={
        <button
          type="button"
          className={cn(
            'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
            canvasActive
              ? isOpen ? 'bg-muted text-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!canvasActive) {
              onToggleCanvas?.()
            } else {
              onOpenChange(!isOpen)
            }
          }}
        />
      }>
        <Maximize2 className="size-4" />
      </Popover.Trigger>
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
                  onSetCanvasZoom?.(canvasZoom * 1.25)
                }}
              >
                <ZoomIn className="size-3.5" />
                Zoom in
              </BaseButton>
              <BaseButton
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                onClick={() => {
                  onSetCanvasZoom?.(canvasZoom / 1.25)
                }}
              >
                <ZoomOut className="size-3.5" />
                Zoom out
              </BaseButton>
              <BaseButton
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                onClick={() => {
                  onZoomTo100?.()
                  onOpenChange(false)
                }}
              >
                <Scan className="size-3.5" />
                Zoom to 100%
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
                {canvasActive && <Check className="size-3.5" />}
                Enable canvas mode
              </BaseButton>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </ZoomPopoverPortal>
    </Popover.Root>
  )
}

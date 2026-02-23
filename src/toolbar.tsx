import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEditState, useDirectEditActions } from './provider'
import { useRulersVisible } from './rulers-overlay'
import { cn } from './cn'
import { useToolbarDock } from './use-toolbar-dock'
import { MousePointer2, Ruler, Command, ArrowBigUp, MessageSquare, X } from 'lucide-react'
import type { ActiveTool, Theme, SessionItem } from './types'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from './ui/tooltip'
import { EditsPopover } from './toolbar/edits-popover'
import { SettingsPopover } from './toolbar/settings-popover'
import { ZoomPopover } from './toolbar/zoom-popover'

export interface DirectEditToolbarInnerProps {
  editModeActive: boolean
  onToggleEditMode: () => void
  rulersVisible: boolean
  onToggleRulers: () => void
  activeTool?: ActiveTool
  onSetActiveTool?: (tool: ActiveTool) => void
  theme?: Theme
  onSetTheme?: (theme: Theme) => void
  sessionEditCount?: number
  onGetSessionItems?: () => SessionItem[]
  onExportAllEdits?: () => Promise<boolean>
  onSendAllToAgents?: () => Promise<boolean>
  onClearSessionEdits?: () => void
  onRemoveSessionEdit?: (element: HTMLElement) => void
  onDeleteComment?: (id: string) => void
  className?: string
  canvasActive?: boolean
  canvasZoom?: number
  onToggleCanvas?: () => void
  onSetCanvasZoom?: (zoom: number) => void
  onZoomTo100?: () => void
  onFitToViewport?: () => void
}

export function DirectEditToolbarInner({
  editModeActive,
  onToggleEditMode,
  rulersVisible,
  onToggleRulers,
  activeTool = 'select',
  onSetActiveTool,
  theme = 'system',
  onSetTheme,
  sessionEditCount = 0,
  onGetSessionItems,
  onExportAllEdits,
  onSendAllToAgents,
  onClearSessionEdits,
  onRemoveSessionEdit,
  onDeleteComment,
  className,
  canvasActive = false,
  canvasZoom = 1,
  onToggleCanvas,
  onSetCanvasZoom,
  onZoomTo100,
  onFitToViewport,
}: DirectEditToolbarInnerProps) {
  const container = usePortalContainer()
  const toolbarRef = React.useRef<HTMLDivElement>(null)
  const { dockedEdge, isDragging, isSnapping, style: dockStyle, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } = useToolbarDock(toolbarRef)
  const isVertical = dockedEdge === 'left' || dockedEdge === 'right'
  const [activePopover, setActivePopover] = React.useState<'edits' | 'settings' | 'zoom' | null>(null)

  // Close active popover when toolbar starts dragging
  React.useEffect(() => {
    if (isDragging) setActivePopover(null)
  }, [isDragging])
  const tooltipSide = dockedEdge === 'bottom' ? 'top'
    : dockedEdge === 'top' ? 'bottom'
    : dockedEdge === 'left' ? 'right' : 'left'
  const [isMac, setIsMac] = React.useState(false)

  React.useEffect(() => {
    setIsMac(navigator.platform?.includes('Mac') ?? false)
  }, [])

  const kbdClass = 'inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground min-w-[20px] min-h-[18px]'

  const shortcutContent = isMac ? (
    <>
      <kbd className={kbdClass}><Command className="size-2.5" /></kbd>
      <kbd className={kbdClass}>.</kbd>
    </>
  ) : (
    <>
      <kbd className={kbdClass}>Ctrl</kbd>
      <kbd className={kbdClass}>.</kbd>
    </>
  )

  const toolbar = (
    <>
      <div
        ref={toolbarRef}
        data-direct-edit="toolbar"
        style={{ pointerEvents: 'auto', touchAction: 'none', ...dockStyle }}
        className={cn(
          'group z-[99999] flex rounded-xl outline outline-1 outline-foreground/10 bg-background p-1.5 shadow-lg transition-shadow duration-200',
          isVertical ? 'flex-col items-center' : 'flex-row items-center',
          isDragging && 'cursor-grabbing select-none shadow-2xl',
          className
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
      >
        {/* Handlebar */}
        <div className={cn(
          'flex shrink-0 cursor-grab items-center justify-center',
          isVertical ? 'w-full pt-0 pb-1.5' : 'h-full pl-0 pr-1.5'
        )}>
          <div className={cn(
            'shrink-0 rounded-full bg-foreground/25',
            isVertical ? 'h-0.5 w-4' : 'h-4 w-0.5'
          )} />
        </div>

        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                editModeActive && activeTool !== 'comment'
                  ? 'bg-foreground text-background hover:bg-foreground/80'
                  : editModeActive && activeTool === 'comment'
                    ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
              onClick={() => {
                if (editModeActive && activeTool === 'comment') {
                  onSetActiveTool?.('select')
                } else {
                  onToggleEditMode()
                }
              }}
            >
              <MousePointer2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} className="inline-flex items-center gap-1.5">
              <span>{editModeActive ? 'Select' : 'Activate design mode'}</span>
              {shortcutContent}
            </TooltipContent>
          </Tooltip>

          <div
            className={cn(
              'overflow-hidden transition-[max-width,max-height,margin,opacity] duration-300 ease-out',
              isVertical
                ? (editModeActive ? 'mt-1 max-h-[500px] opacity-100' : 'mt-0 max-h-0 opacity-0')
                : (editModeActive ? 'ml-1 max-w-[500px] opacity-100' : 'ml-0 max-w-0 opacity-0')
            )}
          >
            <div className={cn('flex gap-1', isVertical ? 'flex-col items-center' : 'flex-row items-center')}>
              <Tooltip>
                <TooltipTrigger
                  className={cn(
                    'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                    activeTool === 'comment'
                      ? 'bg-foreground text-background hover:bg-foreground/80'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onSetActiveTool?.(activeTool === 'comment' ? 'select' : 'comment')}
                >
                  <MessageSquare className="size-4" />
                </TooltipTrigger>
                <TooltipContent side={tooltipSide} className="inline-flex items-center gap-1.5">
                  <span>{activeTool === 'comment' ? 'Exit comment mode' : 'Comment'}</span>
                  <kbd className={kbdClass}><ArrowBigUp className="size-3" /></kbd>
                  <kbd className={kbdClass}>C</kbd>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  className={cn(
                    'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                    rulersVisible
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onToggleRulers}
                >
                  <Ruler className="size-4" />
                </TooltipTrigger>
                <TooltipContent side={tooltipSide} className="inline-flex items-center gap-1.5">
                  <span>{rulersVisible ? 'Hide rulers' : 'Show rulers'}</span>
                  <kbd className={kbdClass}><ArrowBigUp className="size-2.5" /></kbd>
                  <kbd className={kbdClass}>R</kbd>
                </TooltipContent>
              </Tooltip>

              <ZoomPopover
                tooltipSide={tooltipSide}
                canvasActive={canvasActive}
                canvasZoom={canvasZoom}
                isOpen={activePopover === 'zoom'}
                onOpenChange={(open) => setActivePopover(open ? 'zoom' : null)}
                onToggleCanvas={onToggleCanvas}
                onSetCanvasZoom={onSetCanvasZoom}
                onZoomTo100={onZoomTo100}
                onFitToViewport={onFitToViewport}
              />

              <div className={cn(
                'border-foreground/10',
                isVertical ? 'my-0.5 w-5 border-t' : 'mx-0.5 h-5 border-l'
              )} />

              <EditsPopover
                tooltipSide={tooltipSide}
                sessionEditCount={sessionEditCount}
                isOpen={activePopover === 'edits'}
                onOpenChange={(open) => setActivePopover(open ? 'edits' : null)}
                onGetSessionItems={onGetSessionItems}
                onExportAllEdits={onExportAllEdits}
                onSendAllToAgents={onSendAllToAgents}
                onClearSessionEdits={onClearSessionEdits}
                onRemoveSessionEdit={onRemoveSessionEdit}
                onDeleteComment={onDeleteComment}
              />

              <SettingsPopover
                tooltipSide={tooltipSide}
                theme={theme}
                isMac={isMac}
                isOpen={activePopover === 'settings'}
                onOpenChange={(open) => setActivePopover(open ? 'settings' : null)}
                onSetTheme={onSetTheme}
              />

              <div className={cn(
                'border-foreground/10',
                isVertical ? 'my-0.5 w-5 border-t' : 'mx-0.5 h-5 border-l'
              )} />

              <Tooltip>
                <TooltipTrigger
                  className="flex cursor-pointer items-center justify-center rounded-[8px] p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onToggleEditMode}
                >
                  <X className="size-4" />
                </TooltipTrigger>
                <TooltipContent side={tooltipSide} className="inline-flex items-center gap-1.5">
                  <span>Close</span>
                  <kbd className={kbdClass}>Esc</kbd>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </>
  )

  if (container) {
    return createPortal(toolbar, container)
  }

  return toolbar
}

function DirectEditToolbarContent() {
  const { editModeActive, activeTool, theme, sessionEditCount, canvas } = useDirectEditState()
  const {
    toggleEditMode, setActiveTool, setTheme,
    getSessionItems, exportAllEdits, sendAllSessionItemsToAgent, clearSessionEdits, removeSessionEdit, deleteComment,
    toggleCanvas, setCanvasZoom, zoomCanvasTo100, fitCanvasToViewport,
  } = useDirectEditActions()
  const [rulersVisible, toggleRulers] = useRulersVisible()

  return (
    <DirectEditToolbarInner
      editModeActive={editModeActive}
      onToggleEditMode={toggleEditMode}
      rulersVisible={rulersVisible}
      onToggleRulers={toggleRulers}
      activeTool={activeTool}
      onSetActiveTool={setActiveTool}
      theme={theme}
      onSetTheme={setTheme}
      sessionEditCount={sessionEditCount}
      onGetSessionItems={getSessionItems}
      onExportAllEdits={exportAllEdits}
      onSendAllToAgents={sendAllSessionItemsToAgent}
      onClearSessionEdits={clearSessionEdits}
      onRemoveSessionEdit={removeSessionEdit}
      onDeleteComment={deleteComment}
      canvasActive={canvas?.active ?? false}
      canvasZoom={canvas?.zoom ?? 1}
      onToggleCanvas={toggleCanvas}
      onSetCanvasZoom={setCanvasZoom}
      onZoomTo100={zoomCanvasTo100}
      onFitToViewport={fitCanvasToViewport}
    />
  )
}

export function DirectEditToolbar() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <DirectEditToolbarContent />
}

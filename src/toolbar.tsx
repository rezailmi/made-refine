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
import { toolbarBtnClass } from './toolbar/shared'

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
  const { dockedEdge, isDragging, isSnapping, style: dockStyle, predictSize, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } = useToolbarDock(toolbarRef)
  const isVertical = dockedEdge === 'left' || dockedEdge === 'right'
  const [activePopover, setActivePopover] = React.useState<'edits' | 'settings' | 'zoom' | null>(null)

  // Cache toolbar sizes per edge + state so prediction stays accurate after re-docking.
  const sizeCacheRef = React.useRef<Record<string, { w: number; h: number }>>({})

  React.useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const key = `${dockedEdge}:${editModeActive ? 'expanded' : 'collapsed'}`
    // Cache size after transition settles
    const timer = setTimeout(() => {
      const rect = el.getBoundingClientRect()
      sizeCacheRef.current[key] = { w: rect.width, h: rect.height }
    }, 350)
    return () => clearTimeout(timer)
  }, [editModeActive, dockedEdge])

  // On toggle, immediately predict the final position so expand + move run in parallel
  const prevEditModeRef = React.useRef(editModeActive)
  React.useEffect(() => {
    if (prevEditModeRef.current === editModeActive) return
    prevEditModeRef.current = editModeActive
    const target = sizeCacheRef.current[`${dockedEdge}:${editModeActive ? 'expanded' : 'collapsed'}`]
    if (target) {
      predictSize(target.w, target.h)
    }
  }, [editModeActive, dockedEdge, predictSize])

  // Close active popover when toolbar starts dragging
  React.useEffect(() => {
    if (isDragging) setActivePopover(null)
  }, [isDragging])

  // Do not leave popovers open when design mode is turned off.
  React.useEffect(() => {
    if (!editModeActive) setActivePopover(null)
  }, [editModeActive])

  const tooltipSide = dockedEdge === 'bottom' ? 'top'
    : dockedEdge === 'top' ? 'bottom'
    : dockedEdge === 'left' ? 'right' : 'left'
  const [isMac] = React.useState(() => (
    typeof navigator !== 'undefined' ? (navigator.platform?.includes('Mac') ?? false) : false
  ))

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
          'group z-[99999] flex rounded-xl outline outline-1 outline-foreground/10 bg-background p-1.5 shadow-lg',
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
                toolbarBtnClass, 'transition-[color,background-color] duration-150 ease-out',
                editModeActive && activeTool !== 'comment'
                  ? 'bg-foreground text-background hover:bg-foreground/80'
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
              'grid place-items-center overflow-hidden',
              isVertical
                ? (editModeActive ? 'mt-1 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]')
                : (editModeActive ? 'ml-1 grid-cols-[1fr]' : 'ml-0 grid-cols-[0fr]')
            )}
            style={{
              transitionProperty: 'grid-template-columns, grid-template-rows, margin',
              transitionDuration: '200ms',
              transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.5, 1)',
              transitionDelay: editModeActive ? '0ms' : '80ms',
            }}
          >
            <div
              className={cn('flex gap-1 overflow-hidden', isVertical ? 'min-h-0 flex-col items-center' : 'min-w-0 flex-row items-center')}
              style={{
                filter: editModeActive ? 'blur(0px)' : 'blur(5px)',
                opacity: editModeActive ? 1 : 0,
                transitionProperty: 'filter, opacity',
                transitionDuration: '250ms, 100ms',
                transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
                transitionDelay: editModeActive ? '80ms' : '0ms',
              }}
            >
              <Tooltip>
                <TooltipTrigger
                  className={cn(
                    toolbarBtnClass,
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
                    toolbarBtnClass,
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
                  className={cn(toolbarBtnClass, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
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

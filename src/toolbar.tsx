import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEdit } from './provider'
import { useRulersVisible } from './rulers-overlay'
import { cn } from './cn'
import { useToolbarDock } from './use-toolbar-dock'
import { Popover } from '@base-ui/react/popover'
import { MousePointer2, Ruler, Command, ArrowBigUp, MessageSquare, EllipsisVertical, Sun, Moon, Monitor, Option } from 'lucide-react'
import type { ActiveTool, Theme } from './types'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from './ui/tooltip'

export interface DirectEditToolbarInnerProps {
  editModeActive: boolean
  onToggleEditMode: () => void
  rulersVisible: boolean
  onToggleRulers: () => void
  activeTool?: ActiveTool
  onSetActiveTool?: (tool: ActiveTool) => void
  theme?: Theme
  onSetTheme?: (theme: Theme) => void
  className?: string
}

function ThemePopoverPortal(props: React.ComponentPropsWithoutRef<typeof Popover.Portal>) {
  const container = usePortalContainer()
  return <Popover.Portal container={container} {...props} />
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
  className,
}: DirectEditToolbarInnerProps) {
  const container = usePortalContainer()
  const toolbarRef = React.useRef<HTMLDivElement>(null)
  const { dockedEdge, isDragging, isSnapping, style: dockStyle, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } = useToolbarDock(toolbarRef)
  const isVertical = dockedEdge === 'left' || dockedEdge === 'right'
  const tooltipSide = dockedEdge === 'bottom' ? 'top'
    : dockedEdge === 'top' ? 'bottom'
    : dockedEdge === 'left' ? 'right' : 'left'
  const [isMac, setIsMac] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const settingsPopupRef = React.useRef<HTMLDivElement>(null)
  const settingsTriggerRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    setIsMac(navigator.platform?.includes('Mac') ?? false)
  }, [])

  // Close settings popover on outside click (Shadow DOM breaks base-ui's dismiss)
  React.useEffect(() => {
    if (!settingsOpen) return

    function handlePointerDown(e: PointerEvent) {
      const path = e.composedPath()
      if (settingsPopupRef.current && path.includes(settingsPopupRef.current)) return
      if (settingsTriggerRef.current && path.includes(settingsTriggerRef.current)) return
      setSettingsOpen(false)
    }

    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [settingsOpen])

  // Close settings popover on drag start
  React.useEffect(() => {
    if (isDragging) setSettingsOpen(false)
  }, [isDragging])

  const kbdClass = 'inline-flex items-center justify-center rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] min-w-[20px] min-h-[18px]'
  const popupKbdClass = 'inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground min-w-[20px] min-h-[18px]'

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
          'group z-[99999] flex rounded-[14px] border border-foreground/10 bg-background p-1.5 shadow-xl transition-shadow duration-200',
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
        {/* Handlebar — slides in on hover or while dragging */}
        <div className={cn(
          'flex shrink-0 cursor-grab items-center justify-center overflow-hidden transition-[max-width,max-height,padding,opacity] duration-200 ease-out',
          isVertical
            ? (isDragging || isSnapping ? 'max-h-3 pt-0 pb-1.5 opacity-100' : 'max-h-0 py-0 opacity-0 group-hover:max-h-3 group-hover:pt-0 group-hover:pb-1.5 group-hover:opacity-100')
            : (isDragging || isSnapping ? 'max-w-3 pl-0 pr-1.5 opacity-100' : 'max-w-0 px-0 opacity-0 group-hover:max-w-3 group-hover:pl-0 group-hover:pr-1.5 group-hover:opacity-100'),
          isVertical ? 'w-full' : 'h-full'
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
                ? (editModeActive ? 'mt-1 max-h-[140px] opacity-100' : 'mt-0 max-h-0 opacity-0')
                : (editModeActive ? 'ml-1 max-w-[140px] opacity-100' : 'ml-0 max-w-0 opacity-0')
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

              <div className={cn(
                'border-foreground/10',
                isVertical ? 'my-0.5 w-5 border-t' : 'mx-0.5 h-5 border-l'
              )} />

              <Popover.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
                <Tooltip>
                  <Popover.Trigger ref={settingsTriggerRef} render={
                    <TooltipTrigger
                      className={cn(
                        'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                        settingsOpen
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    />
                  }>
                    <EllipsisVertical className="size-4" />
                  </Popover.Trigger>
                  <TooltipContent side={tooltipSide}>
                    <span>More</span>
                  </TooltipContent>
                </Tooltip>
                <ThemePopoverPortal>
                  <Popover.Positioner side={tooltipSide} sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
                    <Popover.Popup ref={settingsPopupRef} className="w-[220px] rounded-lg border border-foreground/10 bg-background p-1 shadow-xl">
                      <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium text-foreground">Theme</div>
                      {([
                        { value: 'light' as const, label: 'Light', Icon: Sun },
                        { value: 'dark' as const, label: 'Dark', Icon: Moon },
                        { value: 'system' as const, label: 'System', Icon: Monitor },
                      ]).map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                            theme === value
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          )}
                          onClick={() => {
                            onSetTheme?.(value)
                            setSettingsOpen(false)
                          }}
                        >
                          <Icon className="size-3.5" />
                          {label}
                        </button>
                      ))}
                      <div className="mx-1.5 my-1 border-t border-foreground/10" />
                      <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium text-foreground">Keyboard Shortcuts</div>
                      {([
                        { label: 'Toggle design mode', keys: isMac ? [<Command key="cmd" className="size-2.5" />,'.' ] : ['Ctrl', '.'] },
                        { label: 'Undo', keys: isMac ? [<Command key="cmd" className="size-2.5" />, 'Z'] : ['Ctrl', 'Z'] },
                        { label: 'Toggle comments', keys: [<ArrowBigUp key="shift" className="size-3" />, 'C'] },
                        { label: 'Toggle rulers', keys: [<ArrowBigUp key="shift" className="size-3" />, 'R'] },
                        { label: 'Hover to measure', keys: isMac ? ['Hold', <Option key="opt" className="size-2.5" />] : ['Hold', 'Alt'] },
                        { label: 'Back / Exit', keys: ['Esc'] },
                      ]).map(({ label, keys }) => (
                        <div key={label} className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-muted-foreground">
                          <span>{label}</span>
                          <span className="flex items-center gap-0.5">
                            {keys.map((k, i) => (
                              <kbd key={i} className={popupKbdClass}>{k}</kbd>
                            ))}
                          </span>
                        </div>
                      ))}
                    </Popover.Popup>
                  </Popover.Positioner>
                </ThemePopoverPortal>
              </Popover.Root>
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
  const { editModeActive, toggleEditMode, activeTool, setActiveTool, theme, setTheme } = useDirectEdit()
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

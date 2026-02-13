import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEdit } from './provider'
import { useRulersVisible } from './rulers-overlay'
import { cn } from './cn'
import { useToolbarDock } from './use-toolbar-dock'
import { Popover } from '@base-ui/react/popover'
import { MousePointer2, Ruler, Command, ArrowBigUp, MessageSquare, EllipsisVertical, Sun, Moon, Monitor, Option, ClipboardList, X, Check, Copy } from 'lucide-react'
import type { ActiveTool, Theme, SessionEdit } from './types'
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
  sessionEditCount?: number
  onGetSessionEdits?: () => SessionEdit[]
  onExportAllEdits?: () => Promise<boolean>
  onClearSessionEdits?: () => void
  onRemoveSessionEdit?: (element: HTMLElement) => void
  className?: string
}

function ThemePopoverPortal(props: React.ComponentPropsWithoutRef<typeof Popover.Portal>) {
  const container = usePortalContainer()
  return <Popover.Portal container={container} {...props} />
}

function EditsPopoverPortal(props: React.ComponentPropsWithoutRef<typeof Popover.Portal>) {
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
  sessionEditCount = 0,
  onGetSessionEdits,
  onExportAllEdits,
  onClearSessionEdits,
  onRemoveSessionEdit,
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
  const [editsOpen, setEditsOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const settingsPopupRef = React.useRef<HTMLDivElement>(null)
  const settingsTriggerRef = React.useRef<HTMLButtonElement>(null)
  const editsPopupRef = React.useRef<HTMLDivElement>(null)
  const editsTriggerRef = React.useRef<HTMLButtonElement>(null)
  const [editsSnapshot, setEditsSnapshot] = React.useState<SessionEdit[]>([])

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

  // Close edits popover on outside click (Shadow DOM breaks base-ui's dismiss)
  React.useEffect(() => {
    if (!editsOpen) return

    function handlePointerDown(e: PointerEvent) {
      const path = e.composedPath()
      if (editsPopupRef.current && path.includes(editsPopupRef.current)) return
      if (editsTriggerRef.current && path.includes(editsTriggerRef.current)) return
      setEditsOpen(false)
    }

    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [editsOpen])

  // Refresh snapshot when popover opens
  React.useEffect(() => {
    if (editsOpen && onGetSessionEdits) {
      setEditsSnapshot(onGetSessionEdits())
    }
    if (!editsOpen) {
      setCopied(false)
    }
  }, [editsOpen, onGetSessionEdits])

  // Close popovers on drag start
  React.useEffect(() => {
    if (!isDragging) return
    setSettingsOpen(false)
    setEditsOpen(false)
  }, [isDragging])

  const kbdClass = 'inline-flex items-center justify-center rounded bg-gray-200 text-gray-500 px-1.5 py-0.5 font-mono text-[10px] min-w-[20px] min-h-[18px] dark:bg-gray-700 dark:text-gray-400'
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
                ? (editModeActive ? 'mt-1 max-h-[220px] opacity-100' : 'mt-0 max-h-0 opacity-0')
                : (editModeActive ? 'ml-1 max-w-[200px] opacity-100' : 'ml-0 max-w-0 opacity-0')
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

              <Popover.Root open={editsOpen} onOpenChange={setEditsOpen}>
                <Tooltip>
                  <Popover.Trigger ref={editsTriggerRef} render={
                    <TooltipTrigger
                      className={cn(
                        'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                        sessionEditCount > 0 || editsOpen
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    />
                  }>
                    <ClipboardList className="size-4" />
                  </Popover.Trigger>
                  <TooltipContent side={tooltipSide}>
                    <span>Session edits</span>
                  </TooltipContent>
                </Tooltip>
                <EditsPopoverPortal>
                  <Popover.Positioner side={tooltipSide} sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
                    <Popover.Popup ref={editsPopupRef} className="w-[280px] rounded-xl outline outline-1 outline-foreground/10 bg-background shadow-lg" onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}>
                      <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                        <span className="text-xs font-medium text-foreground">Session edits ({editsSnapshot.length})</span>
                        {editsSnapshot.length > 0 && (
                          <button
                            type="button"
                            className="text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              onClearSessionEdits?.()
                              setEditsSnapshot([])
                            }}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      {editsSnapshot.length === 0 ? (
                        <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground">
                          No edits yet. Select elements and make changes.
                        </div>
                      ) : (
                        <>
                          <div className="max-h-[240px] overflow-y-auto px-1 py-1">
                            {editsSnapshot.map((edit, i) => {
                              const componentName = edit.locator.reactStack[0]?.name ?? edit.locator.tagName
                              const styleCount = Object.keys(edit.pendingStyles).length
                              const parts: string[] = []
                              if (styleCount > 0) parts.push(`${styleCount} style${styleCount !== 1 ? 's' : ''}`)
                              if (edit.move) parts.push('moved')
                              return (
                                <div
                                  key={i}
                                  className="group flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium text-foreground">&lt;{componentName}&gt;</div>
                                    <div className="text-[11px] text-muted-foreground">{parts.join(', ')}</div>
                                  </div>
                                  <button
                                    type="button"
                                    className="ml-2 flex-shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                                    onClick={() => {
                                      onRemoveSessionEdit?.(edit.element)
                                      setEditsSnapshot((prev) => prev.filter((_, j) => j !== i))
                                    }}
                                  >
                                    <X className="size-3" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                          <div className="border-t border-foreground/10 p-2">
                            <button
                              type="button"
                              className="flex w-full items-center justify-center rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/80"
                              onClick={async () => {
                                const success = await onExportAllEdits?.()
                                if (success) {
                                  setCopied(true)
                                  setTimeout(() => setCopied(false), 2000)
                                }
                              }}
                            >
                              {copied ? (
                                <Check className="mr-1 size-3 text-green-400" />
                              ) : (
                                <Copy className="mr-1 size-3" />
                              )}
                              {copied ? 'Copied! Paste to AI agent' : 'Copy all edits'}
                            </button>
                          </div>
                        </>
                      )}
                    </Popover.Popup>
                  </Popover.Positioner>
                </EditsPopoverPortal>
              </Popover.Root>

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
                    <Popover.Popup ref={settingsPopupRef} className="w-[220px] rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 shadow-lg" onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}>
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
  const {
    editModeActive, toggleEditMode, activeTool, setActiveTool, theme, setTheme,
    sessionEditCount, getSessionEdits, exportAllEdits, clearSessionEdits, removeSessionEdit,
  } = useDirectEdit()
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
      onGetSessionEdits={getSessionEdits}
      onExportAllEdits={exportAllEdits}
      onClearSessionEdits={clearSessionEdits}
      onRemoveSessionEdit={removeSessionEdit}
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

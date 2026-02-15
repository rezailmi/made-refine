import * as React from 'react'
import { createPortal } from 'react-dom'
import { Button as BaseButton } from '@base-ui/react/button'
import { usePortalContainer } from './portal-container'
import { useDirectEditState, useDirectEditActions } from './provider'
import { useRulersVisible } from './rulers-overlay'
import { cn } from './cn'
import { useToolbarDock } from './use-toolbar-dock'
import { Popover } from '@base-ui/react/popover'
import { MousePointer2, Ruler, Command, ArrowBigUp, MessageSquare, EllipsisVertical, Sun, Moon, Monitor, Option, X, Check, Copy, Trash2 } from 'lucide-react'
import type { ActiveTool, Theme, SessionItem } from './types'
import { Badge } from './ui/badge'
import { buildSessionExport } from './utils'
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
  onGetSessionItems?: () => SessionItem[]
  onExportAllEdits?: () => Promise<boolean>
  onClearSessionEdits?: () => void
  onRemoveSessionEdit?: (element: HTMLElement) => void
  onDeleteComment?: (id: string) => void
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

function truncateText(value: string, max = 64): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function isWithinFocusRegion(
  nextTarget: EventTarget | null,
  ...elements: Array<HTMLElement | null>
): boolean {
  if (!(nextTarget instanceof Node)) return false
  return elements.some((element) => Boolean(element?.contains(nextTarget)))
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
  onClearSessionEdits,
  onRemoveSessionEdit,
  onDeleteComment,
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
  const settingsCloseTimerRef = React.useRef<number | null>(null)
  const editsPopupRef = React.useRef<HTMLDivElement>(null)
  const editsTriggerRef = React.useRef<HTMLButtonElement>(null)
  const editsCloseTimerRef = React.useRef<number | null>(null)
  const [editsSnapshot, setEditsSnapshot] = React.useState<SessionItem[]>([])

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
    if (editsOpen && onGetSessionItems) {
      setEditsSnapshot(onGetSessionItems())
    }
  }, [editsOpen, onGetSessionItems])

  React.useEffect(() => {
    return () => {
      if (settingsCloseTimerRef.current !== null) {
        window.clearTimeout(settingsCloseTimerRef.current)
      }
      if (editsCloseTimerRef.current !== null) {
        window.clearTimeout(editsCloseTimerRef.current)
      }
    }
  }, [])

  const clearSettingsCloseTimer = React.useCallback(() => {
    if (settingsCloseTimerRef.current !== null) {
      window.clearTimeout(settingsCloseTimerRef.current)
      settingsCloseTimerRef.current = null
    }
  }, [])

  const scheduleSettingsClose = React.useCallback(() => {
    clearSettingsCloseTimer()
    settingsCloseTimerRef.current = window.setTimeout(() => {
      setSettingsOpen(false)
      settingsCloseTimerRef.current = null
    }, 120)
  }, [clearSettingsCloseTimer])

  const clearEditsCloseTimer = React.useCallback(() => {
    if (editsCloseTimerRef.current !== null) {
      window.clearTimeout(editsCloseTimerRef.current)
      editsCloseTimerRef.current = null
    }
  }, [])

  const scheduleEditsClose = React.useCallback(() => {
    clearEditsCloseTimer()
    editsCloseTimerRef.current = window.setTimeout(() => {
      setEditsOpen(false)
      editsCloseTimerRef.current = null
    }, 120)
  }, [clearEditsCloseTimer])

  const handleCopyAll = React.useCallback(async () => {
    const success = await onExportAllEdits?.()
    if (!success) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [onExportAllEdits])

  const handleCopyItem = React.useCallback(async (item: SessionItem) => {
    const text = item.type === 'edit'
      ? buildSessionExport([item.edit], [])
      : buildSessionExport([], [item.comment])
    try {
      await navigator.clipboard.writeText(`implement the visual edits\n\n${text}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [])

  // Close popovers on drag start
  React.useEffect(() => {
    if (!isDragging) return
    setSettingsOpen(false)
    setEditsOpen(false)
  }, [isDragging])

  const kbdClass = 'inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground min-w-[20px] min-h-[18px]'
  const popupKbdClass = 'inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-muted px-1.5 font-mono text-[10px] text-muted-foreground'

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
                <Popover.Trigger ref={editsTriggerRef} render={
                  <button
                    type="button"
                    className={cn(
                      'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                      sessionEditCount > 0 || editsOpen
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    onPointerEnter={() => {
                      clearEditsCloseTimer()
                      setEditsOpen(true)
                    }}
                    onPointerLeave={scheduleEditsClose}
                    onFocus={(e) => {
                      clearEditsCloseTimer()
                      if (e.currentTarget.matches(':focus-visible')) {
                        setEditsOpen(true)
                      }
                    }}
                    onBlur={(e) => {
                      if (isWithinFocusRegion(e.relatedTarget, editsTriggerRef.current, editsPopupRef.current)) return
                      scheduleEditsClose()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      clearEditsCloseTimer()
                      setEditsOpen((prev) => !prev)
                    }}
                  />
                }>
                  <Copy className="size-4" />
                </Popover.Trigger>
                <EditsPopoverPortal>
                  <Popover.Positioner side={tooltipSide} sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
                    <Popover.Popup
                      ref={editsPopupRef}
                      className="w-[340px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
                      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                      onPointerEnter={clearEditsCloseTimer}
                      onPointerLeave={scheduleEditsClose}
                      onFocus={clearEditsCloseTimer}
                      onBlur={(e) => {
                        if (isWithinFocusRegion(e.relatedTarget, editsTriggerRef.current, editsPopupRef.current)) return
                        scheduleEditsClose()
                      }}
                    >
                      <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                        <span className="text-xs font-medium text-foreground">Copy to AI agents</span>
                        {editsSnapshot.length > 0 && (
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
                      {editsSnapshot.length === 0 ? (
                        <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground">
                          No edits or comments yet.
                        </div>
                      ) : (
                        <div className="max-h-[240px] overflow-y-auto px-1 py-1">
                          {editsSnapshot.map((item, i) => {
                            const isEdit = item.type === 'edit'
                            const isMoved = isEdit && Boolean(item.edit.move)
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
                              if (item.edit.move) {
                                editValues.push(`${item.edit.move.fromParentName} -> ${item.edit.move.toParentName}`)
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
                                key={i}
                                className="group flex cursor-pointer items-start justify-between rounded-md px-1.5 py-1.5 text-xs transition-colors hover:bg-muted/50"
                                onClick={() => {
                                  void handleCopyItem(item)
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
                                    setEditsSnapshot((prev) => prev.filter((_, j) => j !== i))
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

              <Popover.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
                <Popover.Trigger ref={settingsTriggerRef} render={
                  <button
                    type="button"
                    className={cn(
                      'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                      settingsOpen
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    onPointerEnter={() => {
                      clearSettingsCloseTimer()
                      setSettingsOpen(true)
                    }}
                    onPointerLeave={scheduleSettingsClose}
                    onFocus={(e) => {
                      clearSettingsCloseTimer()
                      if (e.currentTarget.matches(':focus-visible')) {
                        setSettingsOpen(true)
                      }
                    }}
                    onBlur={(e) => {
                      if (isWithinFocusRegion(e.relatedTarget, settingsTriggerRef.current, settingsPopupRef.current)) return
                      scheduleSettingsClose()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      clearSettingsCloseTimer()
                      setSettingsOpen((prev) => !prev)
                    }}
                  />
                }>
                  <EllipsisVertical className="size-4" />
                </Popover.Trigger>
                <ThemePopoverPortal>
                  <Popover.Positioner side={tooltipSide} sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
                    <Popover.Popup
                      ref={settingsPopupRef}
                      className="w-[340px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
                      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                      onPointerEnter={clearSettingsCloseTimer}
                      onPointerLeave={scheduleSettingsClose}
                      onFocus={clearSettingsCloseTimer}
                      onBlur={(e) => {
                        if (isWithinFocusRegion(e.relatedTarget, settingsTriggerRef.current, settingsPopupRef.current)) return
                        scheduleSettingsClose()
                      }}
                    >
                      <div className="px-3 pb-1 pt-2.5 text-xs font-medium text-foreground">Theme</div>
                      <div className="px-1 pb-1">
                        {([
                          { value: 'light' as const, label: 'Light', Icon: Sun },
                          { value: 'dark' as const, label: 'Dark', Icon: Moon },
                          { value: 'system' as const, label: 'System', Icon: Monitor },
                        ]).map(({ value, label, Icon }) => (
                          <BaseButton
                            key={value}
                            className={cn(
                              'flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors',
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
                          </BaseButton>
                        ))}
                      </div>
                      <div className="mx-2 my-1 border-t border-foreground/10" />
                      <div className="px-3 pb-1 pt-1.5 text-xs font-medium text-foreground">Keyboard Shortcuts</div>
                      <div className="px-1 pb-1">
                        {([
                          { label: 'Toggle design mode', keys: isMac ? [<Command key="cmd" className="size-2.5" />, '.'] : ['Ctrl', '.'] },
                          { label: 'Undo', keys: isMac ? [<Command key="cmd" className="size-2.5" />, 'Z'] : ['Ctrl', 'Z'] },
                          { label: 'Toggle comments', keys: [<ArrowBigUp key="shift" className="size-3" />, 'C'] },
                          { label: 'Toggle rulers', keys: [<ArrowBigUp key="shift" className="size-3" />, 'R'] },
                          { label: 'Hover to measure', keys: isMac ? ['Hold', <Option key="opt" className="size-2.5" />] : ['Hold', 'Alt'] },
                          { label: 'Back / Exit', keys: ['Esc'] },
                        ]).map(({ label, keys }) => (
                          <div key={label} className="flex h-8 w-full items-center justify-between rounded-md px-2 text-xs text-muted-foreground">
                            <span>{label}</span>
                            <span className="flex items-center gap-0.5">
                              {keys.map((k, i) => (
                                <kbd key={i} className={popupKbdClass}>{k}</kbd>
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
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
  const { editModeActive, activeTool, theme, sessionEditCount } = useDirectEditState()
  const {
    toggleEditMode, setActiveTool, setTheme,
    getSessionItems, exportAllEdits, clearSessionEdits, removeSessionEdit, deleteComment,
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
      onClearSessionEdits={clearSessionEdits}
      onRemoveSessionEdit={removeSessionEdit}
      onDeleteComment={deleteComment}
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

import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEdit } from './provider'
import { useRulersVisible } from './rulers-overlay'
import { cn } from './cn'
import { Popover } from '@base-ui/react/popover'
import { MousePointer2, Ruler, Command, ArrowBigUp, MessageSquare, Settings, Sun, Moon, Monitor } from 'lucide-react'
import type { ActiveTool, Theme } from './types'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from './ui/tooltip'

const ONBOARDING_KEY = 'direct-edit-onboarding-seen'

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

function OnboardingPopover({ shortcut }: { shortcut: React.ReactNode }) {
  const [visible, setVisible] = React.useState(false)
  const container = usePortalContainer()
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null)

  React.useEffect(() => {
    if (!container) return
    if (sessionStorage.getItem(ONBOARDING_KEY)) return

    // Small delay so the toolbar has rendered and we can measure its position
    const showTimer = setTimeout(() => {
      const shadowRoot = container.getRootNode() as ShadowRoot
      const trigger = shadowRoot.querySelector<HTMLElement>('[data-direct-edit="toolbar"]')
      if (trigger) {
        const rect = trigger.getBoundingClientRect()
        setPosition({ x: rect.left + rect.width / 2, y: rect.top })
      }
      setVisible(true)
      sessionStorage.setItem(ONBOARDING_KEY, '1')
    }, 600)

    const dismissTimer = setTimeout(() => {
      setVisible(false)
    }, 8600)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
    }
  }, [container])

  if (!visible || !position || !container) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <div
        className="animate-in fade-in-0 slide-in-from-bottom-2 rounded-lg bg-[#171717] px-3.5 py-2.5 text-xs text-[#fafafa] shadow-lg"
        style={{ pointerEvents: 'auto' }}
      >
        <span>Activate design mode by clicking here or pressing </span>
        {shortcut}
        {/* Arrow pointing down */}
        <div
          style={{
            position: 'absolute',
            bottom: -5,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #171717',
          }}
        />
      </div>
    </div>,
    container,
  )
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

  const kbdClass = 'inline-flex items-center justify-center rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] min-w-[20px] min-h-[18px]'

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
        data-direct-edit="toolbar"
        style={{ pointerEvents: 'auto' }}
        className={cn(
          'fixed bottom-4 left-1/2 z-[99999] -translate-x-1/2 flex items-center rounded-[14px] border border-foreground/10 bg-background p-1.5 shadow-xl transition-all duration-300 ease-in-out',
          className
        )}
      >
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors duration-300',
                editModeActive && activeTool !== 'comment'
                  ? 'bg-foreground text-background hover:bg-foreground/80'
                  : editModeActive && activeTool === 'comment'
                    ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
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
            <TooltipContent side="top" className="inline-flex items-center gap-1.5">
              <span>{editModeActive ? 'Select' : 'Activate design mode'}</span>
              {shortcutContent}
            </TooltipContent>
          </Tooltip>

          <div
            className={cn(
              'overflow-hidden transition-all duration-300 ease-in-out',
              editModeActive ? 'ml-1 max-w-[140px] opacity-100' : 'ml-0 max-w-0 opacity-0'
            )}
          >
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  className={cn(
                    'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                    activeTool === 'comment'
                      ? 'bg-foreground text-background hover:bg-foreground/80'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  onClick={() => onSetActiveTool?.(activeTool === 'comment' ? 'select' : 'comment')}
                >
                  <MessageSquare className="size-4" />
                </TooltipTrigger>
                <TooltipContent side="top" className="inline-flex items-center gap-1.5">
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
                  onClick={onToggleRulers}
                >
                  <Ruler className="size-4" />
                </TooltipTrigger>
                <TooltipContent side="top" className="inline-flex items-center gap-1.5">
                  <span>{rulersVisible ? 'Hide rulers' : 'Show rulers'}</span>
                  <kbd className={kbdClass}><ArrowBigUp className="size-2.5" /></kbd>
                  <kbd className={kbdClass}>R</kbd>
                </TooltipContent>
              </Tooltip>

              <div className="mx-0.5 h-5 border-l border-foreground/10" />

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
                    />
                  }>
                    <Settings className="size-4" />
                  </Popover.Trigger>
                  <TooltipContent side="top">
                    <span>Settings</span>
                  </TooltipContent>
                </Tooltip>
                <ThemePopoverPortal>
                  <Popover.Positioner side="top" sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
                    <Popover.Popup ref={settingsPopupRef} className="w-[140px] rounded-lg border border-foreground/10 bg-background p-1 shadow-xl">
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
                    </Popover.Popup>
                  </Popover.Positioner>
                </ThemePopoverPortal>
              </Popover.Root>
            </div>
          </div>
        </TooltipProvider>
      </div>
      {!editModeActive && <OnboardingPopover shortcut={shortcutContent} />}
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

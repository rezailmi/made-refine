import * as React from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { usePortalContainer } from '../portal-container'
import { Popover } from '@base-ui/react/popover'
import { EllipsisVertical, Sun, Moon, Monitor, Command, ArrowBigUp, Option } from 'lucide-react'
import type { Theme } from '../types'
import { cn } from '../cn'

function ThemePopoverPortal(props: React.ComponentPropsWithoutRef<typeof Popover.Portal>) {
  const container = usePortalContainer()
  return <Popover.Portal container={container} {...props} />
}

function isWithinFocusRegion(
  nextTarget: EventTarget | null,
  ...elements: Array<HTMLElement | null>
): boolean {
  if (!(nextTarget instanceof Node)) return false
  return elements.some((element) => Boolean(element?.contains(nextTarget)))
}

export interface SettingsPopoverProps {
  tooltipSide: 'top' | 'bottom' | 'left' | 'right'
  theme: Theme
  isMac: boolean
  isDragging: boolean
  onSetTheme?: (theme: Theme) => void
}

export function SettingsPopover({
  tooltipSide,
  theme,
  isMac,
  isDragging,
  onSetTheme,
}: SettingsPopoverProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const settingsPopupRef = React.useRef<HTMLDivElement>(null)
  const settingsTriggerRef = React.useRef<HTMLButtonElement>(null)
  const settingsCloseTimerRef = React.useRef<number | null>(null)

  const popupKbdClass = 'inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-muted px-1.5 font-mono text-[10px] text-muted-foreground'

  // Close on outside click (Shadow DOM breaks base-ui's dismiss)
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

  // Cleanup timer
  React.useEffect(() => {
    return () => {
      if (settingsCloseTimerRef.current !== null) {
        window.clearTimeout(settingsCloseTimerRef.current)
      }
    }
  }, [])

  // Close on drag start
  React.useEffect(() => {
    if (isDragging) setSettingsOpen(false)
  }, [isDragging])

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

  return (
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
                      <kbd key={typeof k === 'string' ? k : i} className={popupKbdClass}>{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </ThemePopoverPortal>
    </Popover.Root>
  )
}

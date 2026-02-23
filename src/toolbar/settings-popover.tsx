import * as React from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { usePortalContainer } from '../portal-container'
import { Popover } from '@base-ui/react/popover'
import { EllipsisVertical, Sun, Moon, Monitor, Command, ArrowBigUp, Option, Keyboard, ChevronRight, ChevronLeft } from 'lucide-react'
import type { Theme } from '../types'
import { cn } from '../cn'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../ui/tooltip'

function SettingsPopoverPortal(props: React.ComponentPropsWithoutRef<typeof Popover.Portal>) {
  const container = usePortalContainer()
  return <Popover.Portal container={container} {...props} />
}

export interface SettingsPopoverProps {
  tooltipSide: 'top' | 'bottom' | 'left' | 'right'
  theme: Theme
  isMac: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSetTheme?: (theme: Theme) => void
}

export function SettingsPopover({
  tooltipSide,
  theme,
  isMac,
  isOpen,
  onOpenChange,
  onSetTheme,
}: SettingsPopoverProps) {
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  const settingsPopupRef = React.useRef<HTMLDivElement>(null)
  const settingsTriggerRef = React.useRef<HTMLButtonElement>(null)
  const shortcutsPopupRef = React.useRef<HTMLDivElement>(null)

  const popupKbdClass = 'inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-muted px-1.5 font-mono text-[10px] text-muted-foreground'

  // Close settings on outside click
  React.useEffect(() => {
    if (!isOpen || shortcutsOpen) return

    function handlePointerDown(e: PointerEvent) {
      const path = e.composedPath()
      if (settingsPopupRef.current && path.includes(settingsPopupRef.current)) return
      if (settingsTriggerRef.current && path.includes(settingsTriggerRef.current)) return
      onOpenChange(false)
    }

    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, shortcutsOpen, onOpenChange])

  // Close shortcuts on outside click
  React.useEffect(() => {
    if (!shortcutsOpen) return

    function handlePointerDown(e: PointerEvent) {
      const path = e.composedPath()
      if (shortcutsPopupRef.current && path.includes(shortcutsPopupRef.current)) return
      if (settingsTriggerRef.current && path.includes(settingsTriggerRef.current)) return
      setShortcutsOpen(false)
      onOpenChange(false)
    }

    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [shortcutsOpen, onOpenChange])

  // Close shortcuts when parent closes us
  React.useEffect(() => {
    if (!isOpen) setShortcutsOpen(false)
  }, [isOpen])

  return (
    <>
      <Popover.Root open={isOpen && !shortcutsOpen} onOpenChange={(open) => { if (!open) onOpenChange(false) }}>
        <Tooltip open={isOpen || shortcutsOpen ? false : undefined}>
          <Popover.Trigger ref={settingsTriggerRef} render={
            <TooltipTrigger
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                isOpen || shortcutsOpen
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (shortcutsOpen) {
                  setShortcutsOpen(false)
                } else {
                  onOpenChange(!isOpen)
                }
              }}
            />
          }>
            <EllipsisVertical className="size-4" />
          </Popover.Trigger>
          <TooltipContent side={tooltipSide}>
            <span>Preferences</span>
          </TooltipContent>
        </Tooltip>
        <SettingsPopoverPortal>
          <Popover.Positioner side={tooltipSide} sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
            <Popover.Popup
              ref={settingsPopupRef}
              className="w-[200px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
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
                      onOpenChange(false)
                    }}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </BaseButton>
                ))}
              </div>
              <div className="mx-2 my-1 border-t border-foreground/10" />
              <div className="px-1 pb-1">
                <BaseButton
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => {
                    setShortcutsOpen(true)
                  }}
                >
                  <Keyboard className="size-3.5" />
                  <span className="flex-1">Keyboard shortcuts</span>
                  <ChevronRight className="size-3.5" />
                </BaseButton>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </SettingsPopoverPortal>
      </Popover.Root>

      <Popover.Root open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <Popover.Trigger render={<span />} />
        <SettingsPopoverPortal>
          <Popover.Positioner
            side={tooltipSide}
            sideOffset={12}
            anchor={settingsTriggerRef}
            className="fixed z-[99999]"
            style={{ pointerEvents: 'auto' }}
          >
            <Popover.Popup
              ref={shortcutsPopupRef}
              className="w-[340px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            >
              <BaseButton
                className="flex w-full items-center gap-1 rounded-md px-1.5 pb-1 pt-1.5 text-foreground transition-colors hover:bg-muted/50"
                onClick={() => setShortcutsOpen(false)}
              >
                <ChevronLeft className="size-3.5" />
                <span className="text-xs font-medium">Keyboard Shortcuts</span>
              </BaseButton>
              <div className="px-1 pb-1">
                {([
                  { label: 'Toggle design mode', keys: isMac ? [<Command key="cmd" className="size-2.5" />, '.'] : ['Ctrl', '.'] },
                  { label: 'Undo', keys: isMac ? [<Command key="cmd" className="size-2.5" />, 'Z'] : ['Ctrl', 'Z'] },
                  { label: 'Toggle comments', keys: [<ArrowBigUp key="shift" className="size-3" />, 'C'] },
                  { label: 'Toggle rulers', keys: [<ArrowBigUp key="shift" className="size-3" />, 'R'] },
                  { label: 'Toggle canvas mode', keys: [<ArrowBigUp key="shift" className="size-3" />, 'Z'] },
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
        </SettingsPopoverPortal>
      </Popover.Root>
    </>
  )
}

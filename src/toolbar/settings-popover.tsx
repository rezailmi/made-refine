import * as React from 'react'
import { usePortalContainer } from '../portal-container'
import { Menu } from '@base-ui/react/menu'
import { EllipsisVertical, Sun, Moon, Monitor, Command, ArrowBigUp, Option, Keyboard, ChevronRight } from 'lucide-react'
import type { Theme } from '../types'
import { cn } from '../cn'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../ui/tooltip'

function SettingsMenuPortal(props: React.ComponentPropsWithoutRef<typeof Menu.Portal>) {
  const container = usePortalContainer()
  return <Menu.Portal container={container} {...props} />
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
  const settingsTriggerRef = React.useRef<HTMLButtonElement>(null)
  const settingsPopupRef = React.useRef<HTMLDivElement>(null)

  const popupKbdClass = 'inline-flex h-4 min-w-[18px] items-center justify-center rounded-[6px] bg-muted px-1 text-[9px] font-mono text-muted-foreground'
  const popupTitleClass = 'flex h-8 items-center px-3 text-xs font-medium text-foreground'
  const submenuSide = tooltipSide === 'left' ? 'left' : 'right'
  const centeredSubmenuCollision = React.useMemo(
    () => ({ side: 'flip' as const, align: 'none' as const, fallbackAxisSide: 'none' as const }),
    [],
  )

  return (
    <Menu.Root open={isOpen} onOpenChange={onOpenChange} modal={false}>
      <Tooltip disabled={isOpen}>
        <TooltipTrigger render={
          <Menu.Trigger render={
            <button
              ref={settingsTriggerRef}
              type="button"
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                isOpen
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            />
          } />
        }>
          <EllipsisVertical className="size-4" />
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          <span>Preferences</span>
        </TooltipContent>
      </Tooltip>
      <SettingsMenuPortal>
        <Menu.Positioner side={tooltipSide} sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
          <Menu.Popup
            ref={settingsPopupRef}
            className="w-[200px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          >
            <div className={popupTitleClass}>Preferences</div>
            <div className="px-1 pb-1">
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger
                  openOnHover={false}
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors data-[highlighted]:bg-muted/50 data-[highlighted]:text-foreground"
                >
                  <Monitor className="size-3.5" />
                  <span className="flex-1">Theme</span>
                  <ChevronRight className="size-3.5" />
                </Menu.SubmenuTrigger>
                <SettingsMenuPortal>
                  <Menu.Positioner
                    anchor={settingsPopupRef}
                    side={submenuSide}
                    align="center"
                    sideOffset={6}
                    collisionAvoidance={centeredSubmenuCollision}
                    className="fixed z-[99999]"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Menu.Popup
                      className="w-[200px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
                      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    >
                      <div className={popupTitleClass}>Theme</div>
                      <div className="px-1 pb-1">
                        {([
                          { value: 'light' as const, label: 'Light', Icon: Sun },
                          { value: 'dark' as const, label: 'Dark', Icon: Moon },
                          { value: 'system' as const, label: 'System', Icon: Monitor },
                        ]).map(({ value, label, Icon }) => (
                          <Menu.Item
                            key={value}
                            className={cn(
                              'flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors',
                              theme === value
                                ? 'bg-muted text-foreground'
                                : 'text-muted-foreground data-[highlighted]:bg-muted/50 data-[highlighted]:text-foreground'
                            )}
                            onClick={() => {
                              onSetTheme?.(value)
                              onOpenChange(false)
                            }}
                          >
                            <Icon className="size-3.5" />
                            {label}
                          </Menu.Item>
                        ))}
                      </div>
                    </Menu.Popup>
                  </Menu.Positioner>
                </SettingsMenuPortal>
              </Menu.SubmenuRoot>

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger
                  openOnHover={false}
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors data-[highlighted]:bg-muted/50 data-[highlighted]:text-foreground"
                >
                  <Keyboard className="size-3.5" />
                  <span className="flex-1">Keyboard shortcuts</span>
                  <ChevronRight className="size-3.5" />
                </Menu.SubmenuTrigger>
                <SettingsMenuPortal>
                  <Menu.Positioner
                    anchor={settingsPopupRef}
                    side={submenuSide}
                    align="center"
                    sideOffset={6}
                    collisionAvoidance={centeredSubmenuCollision}
                    className="fixed z-[99999]"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Menu.Popup
                      className="w-[300px] rounded-xl bg-background text-[11px] outline outline-1 outline-foreground/10 shadow-lg"
                      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    >
                      <div className="flex h-7 items-center px-3 text-[11px] font-medium text-foreground">Keyboard Shortcuts</div>
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
                          <div key={label} className="flex h-7 w-full items-center justify-between rounded-md px-2 text-[11px] text-muted-foreground">
                            <span>{label}</span>
                            <span className="flex items-center gap-1">
                              {keys.map((k, i) => (
                                <kbd key={typeof k === 'string' ? k : i} className={popupKbdClass}>{k}</kbd>
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Menu.Popup>
                  </Menu.Positioner>
                </SettingsMenuPortal>
              </Menu.SubmenuRoot>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </SettingsMenuPortal>
    </Menu.Root>
  )
}

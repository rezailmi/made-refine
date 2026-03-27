import * as React from 'react'
import { usePortalContainer } from '../portal-container'
import { Menu } from '@base-ui/react/menu'
import {
  Settings2,
  Sun,
  Moon,
  Monitor,
  Command,
  ArrowBigUp,
  Option,
  Keyboard,
  ChevronRight,
  Ruler,
  Maximize2,
  Check,
} from 'lucide-react'
import type { Theme } from '../types'
import { cn } from '../cn'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../ui/tooltip'
import { toolbarBtnClass } from './shared'

function SettingsMenuPortal(props: React.ComponentPropsWithoutRef<typeof Menu.Portal>) {
  const container = usePortalContainer()
  return <Menu.Portal container={container} {...props} />
}

function stopMenuEvent(event: React.PointerEvent | React.MouseEvent) {
  event.stopPropagation()
}

export interface SettingsPopoverProps {
  tooltipSide: 'top' | 'bottom' | 'left' | 'right'
  theme: Theme
  isMac: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  rulersVisible: boolean
  canvasActive: boolean
  onToggleRulers?: () => void
  onToggleCanvas?: () => void
  onSetTheme?: (theme: Theme) => void
}

export function SettingsPopover({
  tooltipSide,
  theme,
  isMac,
  isOpen,
  onOpenChange,
  rulersVisible,
  canvasActive,
  onToggleRulers,
  onToggleCanvas,
  onSetTheme,
}: SettingsPopoverProps) {
  const popupKbdClass = 'inline-flex h-4 min-w-[18px] items-center justify-center rounded-[6px] bg-muted px-1 text-[9px] font-mono text-muted-foreground'
  const popupTitleClass = 'flex h-8 items-center px-3 text-xs font-medium text-foreground'
  const popupItemClass = 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors data-[highlighted]:bg-muted/50 data-[highlighted]:text-foreground'
  const popupActiveItemClass = 'bg-muted text-foreground'
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
              type="button"
              className={cn(
                toolbarBtnClass,
                isOpen
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            />
          } />
        }>
          <Settings2 className="size-4" />
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          <span>Preferences</span>
        </TooltipContent>
      </Tooltip>
      <SettingsMenuPortal>
        <Menu.Positioner side={tooltipSide} sideOffset={12} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
          <Menu.Popup
            data-direct-edit="settings-menu"
            className="w-[240px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
            onPointerDown={stopMenuEvent}
            onClick={stopMenuEvent}
          >
            <div className={popupTitleClass}>Preferences</div>
            <div className="flex flex-col gap-1 px-1 pb-1">
              <Menu.Item
                className={cn(
                  popupItemClass,
                  rulersVisible && popupActiveItemClass,
                )}
                onClick={() => {
                  onToggleRulers?.()
                  onOpenChange(false)
                }}
              >
                <Ruler className="size-3.5" />
                <span className="flex-1">Rulers</span>
                <Check className={cn('size-3.5', rulersVisible ? 'opacity-100' : 'opacity-0')} />
              </Menu.Item>

              <Menu.Item
                className={cn(
                  popupItemClass,
                  canvasActive && popupActiveItemClass,
                )}
                onClick={() => {
                  onToggleCanvas?.()
                  onOpenChange(false)
                }}
              >
                <Maximize2 className="size-3.5" />
                <span className="flex-1">Canvas mode</span>
                <Check className={cn('size-3.5', canvasActive ? 'opacity-100' : 'opacity-0')} />
              </Menu.Item>

              <div className="my-1 border-t border-foreground/10" />

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger
                  openOnHover={false}
                  className={popupItemClass}
                >
                  <Monitor className="size-3.5" />
                  <span className="flex-1">Theme</span>
                  <ChevronRight className="size-3.5" />
                </Menu.SubmenuTrigger>
                <SettingsMenuPortal>
                  <Menu.Positioner
                    side={submenuSide}
                    align="center"
                    sideOffset={6}
                    collisionAvoidance={centeredSubmenuCollision}
                    className="fixed z-[99999]"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Menu.Popup
                      data-direct-edit="settings-submenu"
                      className="w-[240px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
                      onPointerDown={stopMenuEvent}
                      onClick={stopMenuEvent}
                    >
                      <div className={popupTitleClass}>Theme</div>
                      <div className="flex flex-col gap-1 px-1 pb-1">
                        {([
                          { value: 'light' as const, label: 'Light', Icon: Sun },
                          { value: 'dark' as const, label: 'Dark', Icon: Moon },
                          { value: 'system' as const, label: 'System', Icon: Monitor },
                        ]).map(({ value, label, Icon }) => (
                          <Menu.Item
                            key={value}
                            className={cn(
                              popupItemClass,
                              theme === value && popupActiveItemClass,
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
                  className={popupItemClass}
                >
                  <Keyboard className="size-3.5" />
                  <span className="flex-1">Keyboard shortcuts</span>
                  <ChevronRight className="size-3.5" />
                </Menu.SubmenuTrigger>
                <SettingsMenuPortal>
                  <Menu.Positioner
                    side={submenuSide}
                    align="center"
                    sideOffset={6}
                    collisionAvoidance={centeredSubmenuCollision}
                    className="fixed z-[99999]"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Menu.Popup
                      data-direct-edit="settings-submenu"
                      className="w-[240px] rounded-xl bg-background text-xs outline outline-1 outline-foreground/10 shadow-lg"
                      onPointerDown={stopMenuEvent}
                      onClick={stopMenuEvent}
                    >
                      <div className={popupTitleClass}>Keyboard Shortcuts</div>
                      <div className="flex flex-col gap-1 px-1 pb-1">
                        {([
                          { label: 'Toggle design mode', keys: isMac ? [<Command key="cmd" className="size-2.5" />, '.'] : ['Ctrl', '.'] },
                          { label: 'Undo', keys: isMac ? [<Command key="cmd" className="size-2.5" />, 'Z'] : ['Ctrl', 'Z'] },
                          { label: 'Group selection', keys: isMac ? [<Command key="cmd" className="size-2.5" />, 'G'] : ['Ctrl', 'G'] },
                          { label: 'Add frame', keys: ['F'] },
                          { label: 'Add text', keys: ['T'] },
                          { label: 'Add div', keys: ['D'] },
                          { label: 'Add to selection', keys: [<ArrowBigUp key="shift" className="size-3" />, 'Click'] },
                          { label: 'Marquee select', keys: ['Drag'] },
                          { label: 'Toggle rulers', keys: [<ArrowBigUp key="shift" className="size-3" />, 'R'] },
                          { label: 'Toggle canvas mode', keys: [<ArrowBigUp key="shift" className="size-3" />, 'Z'] },
                          { label: 'Hover to measure', keys: isMac ? ['Hold', <Option key="opt" className="size-2.5" />] : ['Hold', 'Alt'] },
                          { label: 'Back / Exit', keys: ['Esc'] },
                        ]).map(({ label, keys }) => (
                          <div key={label} className="flex h-8 w-full items-center justify-between rounded-md px-2 text-xs text-muted-foreground">
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

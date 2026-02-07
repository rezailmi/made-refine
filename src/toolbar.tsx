import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEdit } from './provider'
import { useRulersVisible } from './rulers-overlay'
import { cn } from './cn'
import { MousePointer2, Ruler } from 'lucide-react'
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
  className?: string
}

function OnboardingPopover({ shortcut }: { shortcut: string }) {
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
        className="animate-in fade-in-0 slide-in-from-bottom-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs text-primary-foreground shadow-lg"
        style={{ pointerEvents: 'auto' }}
      >
        <span>Activate design mode by clicking here or pressing </span>
        <kbd className="rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px]">
          {shortcut}
        </kbd>
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
            borderTop: '6px solid hsl(var(--primary))',
          }}
        />
      </div>
    </div>,
    container,
  )
}

export function DirectEditToolbarInner({
  editModeActive,
  onToggleEditMode,
  rulersVisible,
  onToggleRulers,
  className,
}: DirectEditToolbarInnerProps) {
  const container = usePortalContainer()
  const [isMac, setIsMac] = React.useState(false)

  React.useEffect(() => {
    setIsMac(navigator.platform?.includes('Mac') ?? false)
  }, [])

  const shortcut = isMac ? '⌘.' : 'Ctrl+.'

  const toolbar = (
    <>
      <div
        data-direct-edit="toolbar"
        style={{ pointerEvents: 'auto' }}
        className={cn(
          'fixed bottom-4 left-1/2 z-[99999] -translate-x-1/2 flex items-center rounded-[12px] border bg-background p-1 shadow-lg transition-all duration-300 ease-in-out',
          className
        )}
      >
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors duration-300',
                editModeActive
                  ? 'bg-black text-white hover:bg-zinc-800'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              onClick={onToggleEditMode}
            >
              <MousePointer2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <span>{editModeActive ? 'Select' : 'Activate design mode'}</span>
              <kbd className="ml-2 rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px]">
                {shortcut}
              </kbd>
            </TooltipContent>
          </Tooltip>

          <div
            className={cn(
              'overflow-hidden transition-all duration-300 ease-in-out',
              editModeActive ? 'ml-1 max-w-[32px] opacity-100' : 'ml-0 max-w-0 opacity-0'
            )}
          >
            <Tooltip>
              <TooltipTrigger
                className={cn(
                  'flex cursor-pointer items-center justify-center rounded-[8px] p-2 transition-colors',
                  rulersVisible
                    ? 'bg-zinc-200 text-zinc-900'
                    : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                )}
                onClick={onToggleRulers}
              >
                <Ruler className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <span>{rulersVisible ? 'Hide rulers' : 'Show rulers'}</span>
                <kbd className="ml-2 rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px]">
                  ⇧R
                </kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
      {!editModeActive && <OnboardingPopover shortcut={shortcut} />}
    </>
  )

  if (container) {
    return createPortal(toolbar, container)
  }

  return toolbar
}

function DirectEditToolbarContent() {
  const { editModeActive, toggleEditMode } = useDirectEdit()
  const [rulersVisible, toggleRulers] = useRulersVisible()

  return (
    <DirectEditToolbarInner
      editModeActive={editModeActive}
      onToggleEditMode={toggleEditMode}
      rulersVisible={rulersVisible}
      onToggleRulers={toggleRulers}
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

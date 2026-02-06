import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEdit } from './provider'
import { cn } from './cn'
import { MousePointer2 } from 'lucide-react'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from './ui/tooltip'

export interface DirectEditToolbarInnerProps {
  editModeActive: boolean
  onToggleEditMode: () => void
  className?: string
}

export function DirectEditToolbarInner({
  editModeActive,
  onToggleEditMode,
  className,
}: DirectEditToolbarInnerProps) {
  const container = usePortalContainer()
  const [isMac, setIsMac] = React.useState(false)

  React.useEffect(() => {
    setIsMac(navigator.platform?.includes('Mac') ?? false)
  }, [])

  const shortcut = isMac ? '⌘.' : 'Ctrl+.'

  const toolbar = editModeActive ? (
    <div
      data-direct-edit="toolbar"
      style={{ pointerEvents: 'auto' }}
      className={cn(
        'fixed bottom-4 left-1/2 z-[99999] -translate-x-1/2 flex items-center rounded-lg border bg-background p-1 shadow-lg',
        className
      )}
    >
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger
            className="flex cursor-pointer items-center justify-center rounded-md bg-blue-500 p-1.5 text-white hover:bg-blue-600"
            onClick={onToggleEditMode}
          >
            <MousePointer2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <span>Select</span>
            <kbd className="ml-2 rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px]">
              {shortcut}
            </kbd>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  ) : (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger
          data-direct-edit="toolbar"
          style={{ pointerEvents: 'auto' }}
          className={cn(
            'fixed bottom-4 left-1/2 z-[99999] -translate-x-1/2 flex cursor-pointer items-center justify-center rounded-full border border-border bg-background p-2 text-muted-foreground shadow-lg transition-all duration-200 hover:bg-muted hover:text-foreground',
            className
          )}
          onClick={onToggleEditMode}
        >
          <MousePointer2 className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="top">
          <span>Select</span>
          <kbd className="ml-2 rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px]">
            {shortcut}
          </kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  if (container) {
    return createPortal(toolbar, container)
  }

  return toolbar
}

function DirectEditToolbarContent() {
  const { editModeActive, toggleEditMode } = useDirectEdit()

  return (
    <DirectEditToolbarInner
      editModeActive={editModeActive}
      onToggleEditMode={toggleEditMode}
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

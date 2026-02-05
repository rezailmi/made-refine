import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEdit } from './provider'
import { cn } from './cn'
import { Crosshair } from 'lucide-react'

interface DirectEditToolbarInnerProps {
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

  const button = (
    <button
      type="button"
      onClick={onToggleEditMode}
      data-direct-edit="toolbar"
      style={{ pointerEvents: 'auto' }}
      className={cn(
        'fixed bottom-4 left-1/2 z-[99999] -translate-x-1/2 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-lg transition-all duration-200',
        editModeActive
          ? 'border-blue-500/50 bg-blue-500 text-white hover:bg-blue-600'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
        className
      )}
    >
      <Crosshair className="size-4" />
      {editModeActive && <span>Edit Mode Active</span>}
      <kbd
        className={cn(
          'ml-1 rounded px-1.5 py-0.5 font-mono text-[10px]',
          editModeActive ? 'bg-blue-600 text-blue-100' : 'bg-muted text-muted-foreground'
        )}
      >
        {isMac ? '⌘.' : 'Ctrl+.'}
      </kbd>
    </button>
  )

  if (container) {
    return createPortal(button, container)
  }

  return null
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

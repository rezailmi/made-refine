import * as React from 'react'
import { createPortal } from 'react-dom'
import { useDirectEdit } from './provider'
import { cn } from './cn'
import { Crosshair } from 'lucide-react'

interface DirectEditToolbarInnerProps {
  editModeActive: boolean
  onToggleEditMode: () => void
  className?: string
  usePortal?: boolean
}

export function DirectEditToolbarInner({
  editModeActive,
  onToggleEditMode,
  className,
  usePortal = true,
}: DirectEditToolbarInnerProps) {
  const [isMac, setIsMac] = React.useState(false)

  React.useEffect(() => {
    setIsMac(navigator.platform?.includes('Mac') ?? false)
  }, [])

  const button = (
    <button
      type="button"
      onClick={onToggleEditMode}
      data-direct-edit="toolbar"
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-lg transition-all duration-200',
        editModeActive
          ? 'border-blue-500/50 bg-blue-500 text-white hover:bg-blue-600'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
        usePortal && 'fixed bottom-4 left-1/2 z-[99999] -translate-x-1/2',
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

  if (usePortal && typeof document !== 'undefined') {
    return createPortal(button, document.body)
  }

  return button
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

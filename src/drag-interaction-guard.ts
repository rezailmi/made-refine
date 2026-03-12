interface DragInteractionGuardOptions {
  cursor?: string | null
}

export interface DragInteractionGuard {
  activate: (options?: DragInteractionGuardOptions) => void
  deactivate: () => void
}

export function createDragInteractionGuard(): DragInteractionGuard {
  let cleanup: (() => void) | null = null

  function deactivate() {
    cleanup?.()
  }

  function activate(options?: DragInteractionGuardOptions) {
    deactivate()

    if (typeof document === 'undefined') return

    const docEl = document.documentElement
    const body = document.body
    const previousDocUserSelect = docEl.style.userSelect
    const previousBodyUserSelect = body.style.userSelect
    const previousBodyCursor = body.style.cursor
    const cursor = options?.cursor

    try {
      window.getSelection()?.removeAllRanges()
    } catch {
      // Ignore environments without a selection implementation.
    }

    docEl.style.userSelect = 'none'
    body.style.userSelect = 'none'
    if (cursor !== undefined) {
      body.style.cursor = cursor ?? ''
    }

    const blockSelectStart = (event: Event) => {
      event.preventDefault()
    }

    document.addEventListener('selectstart', blockSelectStart, true)

    cleanup = () => {
      document.removeEventListener('selectstart', blockSelectStart, true)
      docEl.style.userSelect = previousDocUserSelect
      body.style.userSelect = previousBodyUserSelect
      if (cursor !== undefined) {
        body.style.cursor = previousBodyCursor
      }
      cleanup = null
    }
  }

  return {
    activate,
    deactivate,
  }
}

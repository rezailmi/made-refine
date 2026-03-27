import * as React from 'react'
import type { DirectEditState, CanvasElementKind } from './types'
import { isTextElement, isInputFocused } from './utils'

export interface KeyboardShortcutsOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  toggleEditMode: () => void
  toggleFlexLayout: () => void
  undo: () => void
  commitTextEditing: () => void
  startTextEditing: (element: HTMLElement) => void
  closePanel: () => void
  clearSelection: () => void
  groupSelection: () => void
  deleteSelection: () => void
  insertElement: (kind: CanvasElementKind) => void
  setState: React.Dispatch<React.SetStateAction<DirectEditState>>
  toggleCanvas: () => void
  setCanvasZoom: (zoom: number) => void
  fitCanvasToViewport: () => void
  zoomCanvasTo100: () => void
}

export function useKeyboardShortcuts({
  stateRef,
  toggleEditMode,
  toggleFlexLayout,
  undo,
  commitTextEditing,
  startTextEditing,
  closePanel,
  clearSelection,
  groupSelection,
  deleteSelection,
  insertElement,
  setState,
  toggleCanvas,
  setCanvasZoom,
  fitCanvasToViewport,
  zoomCanvasTo100,
}: KeyboardShortcutsOptions) {
  const usesMetaForUndo = React.useMemo(
    () => typeof navigator !== 'undefined' && Boolean(navigator.platform?.includes('Mac')),
    [],
  )

  // Toggle edit mode: plain Cmd/Ctrl + Period
  // Uses capture phase so it fires before any stopPropagation() in the host app (e.g. Tauri webview)
  // Uses e.code for layout independence (fallback to e.key for virtual keyboards)
  React.useEffect(() => {
    function handleToggle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.code === 'Period' || e.key === '.')) {
        e.preventDefault()
        toggleEditMode()
      }
    }
    window.addEventListener('keydown', handleToggle, true)
    return () => window.removeEventListener('keydown', handleToggle, true)
  }, [toggleEditMode])

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const s = stateRef.current

      const undoShortcutPressed = usesMetaForUndo
        ? (e.metaKey && !e.ctrlKey && !e.altKey)
        : (e.ctrlKey && !e.metaKey && !e.altKey)

      if (undoShortcutPressed && e.key === 'z' && !e.shiftKey) {
        if (s.textEditingElement) return // let browser handle contenteditable undo
        e.preventDefault()
        undo()
        return
      }

      if (undoShortcutPressed && (e.code === 'KeyG' || e.key.toLowerCase() === 'g') && !e.shiftKey) {
        if (s.editModeActive && s.selectedElements.length > 1 && !isInputFocused()) {
          e.preventDefault()
          groupSelection()
          return
        }
      }

      if (e.key === 'Z' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && s.editModeActive) {
        if (!isInputFocused()) {
          e.preventDefault()
          toggleCanvas()
          return
        }
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && s.canvas?.active) {
        if (e.code === 'Digit0' || e.key === '0') {
          e.preventDefault()
          fitCanvasToViewport()
          return
        }
        if (e.code === 'Digit1' || e.key === '1') {
          e.preventDefault()
          zoomCanvasTo100()
          return
        }
        if (e.code === 'Equal' || e.key === '=') {
          e.preventDefault()
          setCanvasZoom(Math.min(5.0, (s.canvas?.zoom ?? 1) * 1.1))
          return
        }
        if (e.code === 'Minus' || e.key === '-') {
          e.preventDefault()
          setCanvasZoom(Math.max(0.1, (s.canvas?.zoom ?? 1) / 1.1))
          return
        }
      }

      if (e.key === 'A' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && s.editModeActive && s.selectedElement) {
        if (!isInputFocused()) {
          e.preventDefault()
          toggleFlexLayout()
          return
        }
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey && s.editModeActive && !isInputFocused()) {
        const lowerKey = e.key.toLowerCase()
        if (lowerKey === 'f') {
          e.preventDefault()
          insertElement('frame')
          return
        }
        if (lowerKey === 't') {
          e.preventDefault()
          insertElement('text')
          return
        }
        if (lowerKey === 'd') {
          e.preventDefault()
          insertElement('div')
          return
        }
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && s.editModeActive && !s.textEditingElement) {
        if (!isInputFocused() && s.selectedElements.length > 0) {
          e.preventDefault()
          deleteSelection()
          return
        }
      }

      if (e.key === 'Enter' && s.editModeActive && !s.textEditingElement && s.selectedElement) {
        if (!isInputFocused() && isTextElement(s.selectedElement)) {
          e.preventDefault()
          startTextEditing(s.selectedElement)
          return
        }
      }

      if (e.key === 'Escape') {
        if (s.textEditingElement) {
          commitTextEditing()
          return
        }
        if (s.activeCommentId) {
          setState((prev) => {
            let comments = prev.comments
            const active = comments.find((c) => c.id === prev.activeCommentId)
            if (active && active.text === '') {
              comments = comments.filter((c) => c.id !== prev.activeCommentId)
            }
            return { ...prev, comments, activeCommentId: null }
          })
        } else if (s.isOpen) {
          closePanel()
        } else if (s.selectedElements.length > 0) {
          clearSelection()
        } else if (s.editModeActive) {
          toggleEditMode()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSelection, closePanel, commitTextEditing, deleteSelection, fitCanvasToViewport, groupSelection, insertElement, setCanvasZoom, setState, startTextEditing, toggleCanvas, toggleEditMode, toggleFlexLayout, undo, usesMetaForUndo, zoomCanvasTo100])
}

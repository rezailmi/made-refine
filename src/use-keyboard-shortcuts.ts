import * as React from 'react'
import type { DirectEditState, ActiveTool } from './types'
import { isTextElement, isInputFocused } from './utils'

export interface KeyboardShortcutsOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  toggleEditMode: () => void
  toggleFlexLayout: () => void
  undo: () => void
  commitTextEditing: () => void
  startTextEditing: (element: HTMLElement) => void
  closePanel: () => void
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
  setState,
  toggleCanvas,
  setCanvasZoom,
  fitCanvasToViewport,
  zoomCanvasTo100,
}: KeyboardShortcutsOptions) {

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

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (s.textEditingElement) return // let browser handle contenteditable undo
        e.preventDefault()
        undo()
        return
      }

      if (e.key === 'C' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && s.editModeActive) {
        if (!isInputFocused()) {
          e.preventDefault()
          setState((prev) => {
            let comments = prev.comments
            if (prev.activeCommentId) {
              const active = comments.find((c) => c.id === prev.activeCommentId)
              if (active && active.text === '') {
                comments = comments.filter((c) => c.id !== prev.activeCommentId)
              }
            }
            return {
              ...prev,
              comments,
              activeTool: prev.activeTool === 'comment' ? 'select' as ActiveTool : 'comment' as ActiveTool,
              activeCommentId: null,
            }
          })
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
        } else if (s.activeTool === 'comment') {
          setState((prev) => ({ ...prev, activeTool: 'select' as ActiveTool }))
        } else if (s.isOpen) {
          closePanel()
        } else if (s.editModeActive) {
          toggleEditMode()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closePanel, toggleEditMode, toggleFlexLayout, undo, commitTextEditing, startTextEditing, toggleCanvas, setCanvasZoom, fitCanvasToViewport, zoomCanvasTo100, setState])
}

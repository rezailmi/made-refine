import * as React from 'react'
import type { DirectEditState, ActiveTool } from './types'
import { isTextElement } from './utils'

export interface KeyboardShortcutsOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  toggleEditMode: () => void
  toggleFlexLayout: () => void
  undo: () => void
  commitTextEditing: () => void
  startTextEditing: (element: HTMLElement) => void
  closePanel: () => void
  setState: React.Dispatch<React.SetStateAction<DirectEditState>>
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
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
        if (!isInput) {
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

      if (e.key === 'A' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && s.editModeActive && s.selectedElement) {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
        if (!isInput) {
          e.preventDefault()
          toggleFlexLayout()
          return
        }
      }

      if (e.key === 'Enter' && s.editModeActive && !s.textEditingElement && s.selectedElement) {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
        if (!isInput && isTextElement(s.selectedElement)) {
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
  }, [closePanel, toggleEditMode, toggleFlexLayout, undo, commitTextEditing, startTextEditing])
}

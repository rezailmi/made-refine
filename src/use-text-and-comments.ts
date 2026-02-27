import * as React from 'react'
import type {
  DirectEditState,
  UndoEntry,
  SessionEdit,
  Comment,
} from './types'
import {
  getElementLocator,
  buildCommentExport,
  buildExportInstruction,
  isTextElement,
} from './utils'
import { copyText } from './clipboard'

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export interface TextAndCommentsOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  sessionEditsRef: React.MutableRefObject<Map<HTMLElement, SessionEdit>>
  removedSessionEditsRef: React.MutableRefObject<WeakSet<HTMLElement>>
  pushUndo: (entry: UndoEntry) => void
  syncSessionItemCount: (comments?: Comment[]) => void
  setState: React.Dispatch<React.SetStateAction<DirectEditState>>
}

export function useTextAndComments({
  stateRef,
  sessionEditsRef,
  removedSessionEditsRef,
  pushUndo,
  syncSessionItemCount,
  setState,
}: TextAndCommentsOptions) {

  const finalizeTextEditing = React.useCallback((editingElement: HTMLElement) => {
    const newText = editingElement.textContent ?? ''
    const existing = sessionEditsRef.current.get(editingElement)
    const originalText = existing?.textEdit?.originalText
      ?? editingElement.getAttribute('data-direct-edit-original-text')
      ?? newText
    const previousText = existing?.textEdit?.newText ?? originalText

    editingElement.removeAttribute('contenteditable')
    editingElement.removeAttribute('data-direct-edit-original-text')
    const originalCursor = editingElement.getAttribute('data-direct-edit-original-cursor') ?? ''
    editingElement.removeAttribute('data-direct-edit-original-cursor')
    editingElement.style.outline = ''
    editingElement.style.outlineOffset = ''
    editingElement.style.cursor = originalCursor
    editingElement.blur()

    if (newText !== previousText) {
      pushUndo({ type: 'textEdit', element: editingElement, originalText, previousText })
      removedSessionEditsRef.current.delete(editingElement)

      if (newText === originalText) {
        // Reverted to original - remove textEdit from session
        if (existing) {
          if (Object.keys(existing.pendingStyles).length > 0 || existing.move) {
            sessionEditsRef.current.set(editingElement, { ...existing, textEdit: null })
          } else {
            sessionEditsRef.current.delete(editingElement)
          }
        }
      } else {
        const current = stateRef.current
        const locator = existing?.locator ?? getElementLocator(editingElement)
        const originalStyles = existing?.originalStyles
          ?? (current.selectedElement === editingElement ? { ...current.originalStyles } : {})
        const pendingStyles = existing?.pendingStyles
          ?? (current.selectedElement === editingElement ? { ...current.pendingStyles } : {})
        sessionEditsRef.current.set(editingElement, {
          element: editingElement,
          locator,
          originalStyles,
          pendingStyles,
          move: existing?.move ?? null,
          textEdit: { originalText, newText },
        })
      }
      syncSessionItemCount()
    }

    setState((prev) => (prev.textEditingElement ? { ...prev, textEditingElement: null } : prev))
  }, [pushUndo, syncSessionItemCount])

  const toggleEditMode = React.useCallback(() => {
    const current = stateRef.current
    if (current.editModeActive && current.textEditingElement) {
      finalizeTextEditing(current.textEditingElement)
    }

    setState((prev) => ({
      ...prev,
      editModeActive: !prev.editModeActive,
      activeTool: prev.editModeActive ? 'select' : prev.activeTool,
      activeCommentId: prev.editModeActive ? null : prev.activeCommentId,
    }))
  }, [finalizeTextEditing])

  const addComment = React.useCallback((element: HTMLElement, clickPosition: { x: number; y: number }) => {
    const locator = getElementLocator(element)
    const rect = element.getBoundingClientRect()
    const relativePosition = {
      x: rect.width > 0 ? clampUnit((clickPosition.x - rect.left) / rect.width) : 0,
      y: rect.height > 0 ? clampUnit((clickPosition.y - rect.top) / rect.height) : 0,
    }
    const id = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const comment: Comment = {
      id,
      element,
      locator,
      clickPosition,
      relativePosition,
      text: '',
      createdAt: Date.now(),
      replies: [],
    }
    setState((prev) => {
      // Remove previously active empty comment
      const filtered = prev.activeCommentId
        ? prev.comments.filter((c) => c.id !== prev.activeCommentId || c.text.trim().length > 0)
        : prev.comments
      return {
        ...prev,
        comments: [...filtered, comment],
        activeCommentId: id,
      }
    })
  }, [])

  const updateCommentText = React.useCallback((id: string, text: string) => {
    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((c) => (c.id === id ? { ...c, text } : c)),
    }))
  }, [])

  const addCommentReply = React.useCallback((id: string, text: string) => {
    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === id
          ? { ...c, replies: [...c.replies, { text, createdAt: Date.now() }] }
          : c
      ),
    }))
  }, [])

  const deleteComment = React.useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      comments: prev.comments.filter((c) => c.id !== id),
      activeCommentId: prev.activeCommentId === id ? null : prev.activeCommentId,
    }))
  }, [])

  const exportComment = React.useCallback(async (id: string) => {
    const comment = stateRef.current.comments.find((c) => c.id === id)
    if (!comment) return false

    const exportMarkdown = buildCommentExport(comment.locator, comment.text, comment.replies)
    const instruction = buildExportInstruction({
      hasCssEdits: false,
      hasTextEdits: false,
      hasMoves: false,
      hasComments: true,
    })
    return copyText(`${instruction}\n\n${exportMarkdown}`)
  }, [])

  const setActiveCommentId = React.useCallback((id: string | null) => {
    setState((prev) => {
      let comments = prev.comments
      if (prev.activeCommentId && prev.activeCommentId !== id) {
        const active = comments.find((c) => c.id === prev.activeCommentId)
        if (active && active.text === '') {
          comments = comments.filter((c) => c.id !== prev.activeCommentId)
        }
      }
      return { ...prev, comments, activeCommentId: id }
    })
  }, [])

  const startTextEditing = React.useCallback((element: HTMLElement) => {
    if (!isTextElement(element)) return
    if (stateRef.current.textEditingElement) return

    // Determine original text: prefer existing session edit's original
    const existing = sessionEditsRef.current.get(element)
    const originalText = existing?.textEdit?.originalText ?? (element.textContent ?? '')
    element.setAttribute('data-direct-edit-original-text', originalText)
    element.setAttribute('data-direct-edit-original-cursor', element.style.cursor)

    element.setAttribute('contenteditable', 'true')
    element.style.outline = '1px solid #0D99FF'
    element.style.outlineOffset = '0px'
    element.style.cursor = 'text'
    element.focus()

    // Select all text for easy replacement
    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      range.selectNodeContents(element)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    setState((prev) => ({ ...prev, textEditingElement: element }))
  }, [])

  const commitTextEditing = React.useCallback(() => {
    const editingElement = stateRef.current.textEditingElement
    if (!editingElement) return

    finalizeTextEditing(editingElement)
  }, [finalizeTextEditing])

  return {
    finalizeTextEditing,
    toggleEditMode,
    addComment,
    updateCommentText,
    addCommentReply,
    deleteComment,
    exportComment,
    setActiveCommentId,
    startTextEditing,
    commitTextEditing,
  }
}

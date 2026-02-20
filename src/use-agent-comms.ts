import * as React from 'react'
import type {
  DirectEditState,
  SessionEdit,
  SessionItem,
  Comment,
} from './types'
import {
  buildEditExport,
  buildCommentExport,
  buildSessionExport,
  getElementLocator,
  stylesToTailwind,
  collapseExportShorthands,
} from './utils'
import { sendEditToAgent as postEditToAgent, sendCommentToAgent as postCommentToAgent } from './mcp-client'

export interface AgentCommsOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  sessionEditsRef: React.MutableRefObject<Map<HTMLElement, SessionEdit>>
  getSessionItems: () => SessionItem[]
}

export function useAgentComms({ stateRef, sessionEditsRef, getSessionItems }: AgentCommsOptions) {

  const canSendEditToAgent = React.useCallback((snapshot?: {
    selectedElement: HTMLElement | null
    elementInfo: DirectEditState['elementInfo']
    pendingStyles: Record<string, string>
  }) => {
    const current = stateRef.current
    const selectedElement = snapshot?.selectedElement ?? current.selectedElement
    const elementInfo = snapshot?.elementInfo ?? current.elementInfo
    const pendingStyles = snapshot?.pendingStyles ?? current.pendingStyles
    if (!selectedElement || !elementInfo) return false
    const sessionEdit = sessionEditsRef.current.get(selectedElement)
    const hasPendingStyles = Object.keys(pendingStyles).length > 0
    const hasTextEdit = Boolean(sessionEdit?.textEdit)
    const hasMove = Boolean(sessionEdit?.move)
    return hasPendingStyles || hasTextEdit || hasMove
  }, [])

  const sendSessionEditToAgent = React.useCallback(async (sessionEdit: SessionEdit) => {
    const locator = sessionEdit.locator
    const pendingStyles = { ...sessionEdit.pendingStyles }
    const exportMarkdown = sessionEdit.move
      ? buildSessionExport([{
          ...sessionEdit,
          locator,
          pendingStyles,
          textEdit: sessionEdit.textEdit,
        }], [])
      : buildEditExport(locator, pendingStyles, sessionEdit.textEdit)
    const collapsedStyles = collapseExportShorthands(pendingStyles)
    const changes = Object.entries(collapsedStyles).map(([cssProperty, cssValue]) => ({
      cssProperty,
      cssValue,
      tailwindClass: stylesToTailwind({ [cssProperty]: cssValue }),
    }))

    try {
      const result = await postEditToAgent({
        element: {
          tagName: locator.tagName,
          id: locator.id,
          classList: locator.classList,
          domSelector: locator.domSelector,
          targetHtml: locator.targetHtml,
          textPreview: locator.textPreview,
        },
        source: locator.domSource || null,
        reactStack: locator.reactStack,
        changes,
        textChange: sessionEdit.textEdit ?? null,
        moveChange: sessionEdit.move ?? null,
        exportMarkdown,
      })
      return result.ok
    } catch {
      return false
    }
  }, [])

  const sendSessionCommentToAgent = React.useCallback(async (comment: Comment) => {
    const exportMarkdown = buildCommentExport(comment.locator, comment.text, comment.replies)

    try {
      const result = await postCommentToAgent({
        element: {
          tagName: comment.locator.tagName,
          id: comment.locator.id,
          classList: comment.locator.classList,
          domSelector: comment.locator.domSelector,
          targetHtml: comment.locator.targetHtml,
          textPreview: comment.locator.textPreview,
        },
        source: comment.locator.domSource || null,
        reactStack: comment.locator.reactStack,
        commentText: comment.text,
        replies: comment.replies,
        exportMarkdown,
      })
      return result.ok
    } catch {
      return false
    }
  }, [])

  const sendEditToAgent = React.useCallback(async () => {
    const current = stateRef.current
    if (!current.selectedElement || !current.elementInfo) return false
    const sessionEdit = sessionEditsRef.current.get(current.selectedElement)
    if (!canSendEditToAgent({
      selectedElement: current.selectedElement,
      elementInfo: current.elementInfo,
      pendingStyles: current.pendingStyles,
    })) return false

    const locator = getElementLocator(current.selectedElement)
    const editToSend: SessionEdit = {
      element: current.selectedElement,
      locator,
      originalStyles: sessionEdit?.originalStyles ?? { ...current.originalStyles },
      pendingStyles: { ...current.pendingStyles },
      move: sessionEdit?.move ?? null,
      textEdit: sessionEdit?.textEdit ?? null,
    }
    return sendSessionEditToAgent(editToSend)
  }, [canSendEditToAgent, sendSessionEditToAgent])

  const sendCommentToAgent = React.useCallback(async (id: string) => {
    const comment = stateRef.current.comments.find((c) => c.id === id)
    if (!comment) return false
    return sendSessionCommentToAgent(comment)
  }, [sendSessionCommentToAgent])

  const sendAllSessionItemsToAgent = React.useCallback(async () => {
    const items = getSessionItems()
    if (items.length === 0) return false

    let allSucceeded = true
    for (const item of items) {
      const succeeded = item.type === 'edit'
        ? await sendSessionEditToAgent(item.edit)
        : await sendSessionCommentToAgent(item.comment)
      if (!succeeded) {
        allSucceeded = false
      }
    }

    return allSucceeded
  }, [getSessionItems, sendSessionCommentToAgent, sendSessionEditToAgent])

  return {
    canSendEditToAgent,
    sendEditToAgent,
    sendCommentToAgent,
    sendAllSessionItemsToAgent,
  }
}

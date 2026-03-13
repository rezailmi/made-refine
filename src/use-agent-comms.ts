import * as React from 'react'
import type {
  DirectEditState,
  SessionEdit,
  SessionItem,
  Comment,
} from './types'
import {
  buildEditExport,
  buildElementContext,
  buildCommentExport,
  buildSessionExport,
  getElementLocator,
  stylesToTailwind,
  collapseExportShorthands,
  buildMovePlanContext,
  getMoveIntentForEdit,
} from './utils'
import {
  checkAgentConnection,
  sendEditToAgent as postEditToAgent,
  sendCommentToAgent as postCommentToAgent,
} from './mcp-client'

export interface AgentCommsOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  sessionEditsRef: React.MutableRefObject<Map<HTMLElement, SessionEdit>>
  getSessionItems: () => SessionItem[]
  saveCurrentToSession: () => void
}

export function useAgentComms({ stateRef, sessionEditsRef, getSessionItems, saveCurrentToSession }: AgentCommsOptions) {
  const [agentAvailable, setAgentAvailable] = React.useState(false)
  const isMountedRef = React.useRef(true)

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const updateAgentAvailability = React.useCallback((available: boolean) => {
    if (isMountedRef.current) {
      setAgentAvailable(available)
    }
    return available
  }, [])

  const refreshAgentAvailability = React.useCallback(async () => {
    try {
      const available = await checkAgentConnection()
      return updateAgentAvailability(available)
    } catch {
      return updateAgentAvailability(false)
    }
  }, [updateAgentAvailability])

  React.useEffect(() => {
    void refreshAgentAvailability()

    function handleWindowFocus() {
      void refreshAgentAvailability()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshAgentAvailability()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshAgentAvailability])

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
    const hasMove = Boolean(
      sessionEdit?.move
      && getMoveIntentForEdit(sessionEdit, buildMovePlanContext([sessionEdit])),
    )
    return hasPendingStyles || hasTextEdit || hasMove
  }, [])

  const sendSessionEditToAgent = React.useCallback(async (
    sessionEdit: SessionEdit,
    allEdits?: SessionEdit[],
    movePlanContext?: ReturnType<typeof buildMovePlanContext> | null,
    options?: { includeBatchMoveEnvelope?: boolean },
  ) => {
    const locator = sessionEdit.locator
    const pendingStyles = { ...sessionEdit.pendingStyles }
    const editsForPlan = allEdits ?? [sessionEdit]
    const resolvedPlanContext = movePlanContext ?? buildMovePlanContext(editsForPlan)
    const includeBatchMoveEnvelope = Boolean(options?.includeBatchMoveEnvelope && sessionEdit.move)
    const isBatchSend = Boolean(allEdits && allEdits.length > 1)
    const exportMarkdown = sessionEdit.move
      ? buildSessionExport(
          includeBatchMoveEnvelope ? editsForPlan : [sessionEdit],
          [],
          {
            movePlanContext: resolvedPlanContext,
            includeMovePlanHeader: includeBatchMoveEnvelope || !isBatchSend,
          },
        )
      : buildEditExport(locator, pendingStyles, sessionEdit.textEdit)
    const collapsedStyles = collapseExportShorthands(pendingStyles)
    const changes = Object.entries(collapsedStyles).map(([cssProperty, cssValue]) => ({
      cssProperty,
      cssValue,
      tailwindClass: stylesToTailwind({ [cssProperty]: cssValue }),
    }))
    const moveIntent = sessionEdit.move
      ? getMoveIntentForEdit(sessionEdit, resolvedPlanContext)
      : null
    const movePlan = includeBatchMoveEnvelope ? resolvedPlanContext.movePlan : null
    const hasMeaningfulPayload = changes.length > 0 || sessionEdit.textEdit != null || moveIntent != null
    if (!hasMeaningfulPayload) return true

    try {
      // TODO(mcp-server): confirm ingest validation/DTOs accept the non-versioned moveIntent/movePlan schema.
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
        moveIntent,
        ...(movePlan ? { movePlan } : {}),
        exportMarkdown,
      })
      return updateAgentAvailability(result.ok)
    } catch {
      return updateAgentAvailability(false)
    }
  }, [updateAgentAvailability])

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
      return updateAgentAvailability(result.ok)
    } catch {
      return updateAgentAvailability(false)
    }
  }, [updateAgentAvailability])

  const sendEditToAgent = React.useCallback(async () => {
    const current = stateRef.current

    // Multi-selection: bundle all selected elements into a single annotation
    if (current.selectedElements.length > 1) {
      saveCurrentToSession()
      const allLocators: ReturnType<typeof getElementLocator>[] = []
      const editsWithChanges: SessionEdit[] = []
      const contextBlocks: string[] = []

      for (const el of current.selectedElements) {
        if (!el.isConnected) continue
        const edit = sessionEditsRef.current.get(el)
        const locator = getElementLocator(el)
        allLocators.push(locator)
        if (edit && (Object.keys(edit.pendingStyles).length > 0 || edit.textEdit || edit.move)) {
          editsWithChanges.push(edit)
        } else {
          contextBlocks.push(buildElementContext(locator))
        }
      }

      if (allLocators.length === 0) return false

      // Build combined export markdown
      const markdownParts: string[] = []
      if (editsWithChanges.length > 0) {
        const movePlanContext = buildMovePlanContext(editsWithChanges)
        markdownParts.push(buildSessionExport(editsWithChanges, [], { movePlanContext }))
      }
      markdownParts.push(...contextBlocks)
      const exportMarkdown = markdownParts.join('\n\n')

      // Send as a single annotation using the first element as primary
      const primary = allLocators[0]
      try {
        const result = await postEditToAgent({
          element: {
            tagName: primary.tagName,
            id: primary.id,
            classList: primary.classList,
            domSelector: primary.domSelector,
            targetHtml: primary.targetHtml,
            textPreview: primary.textPreview,
          },
          source: primary.domSource || null,
          reactStack: primary.reactStack,
          changes: [],
          textChange: null,
          moveIntent: null,
          exportMarkdown,
        })
        return updateAgentAvailability(result.ok)
      } catch {
        return updateAgentAvailability(false)
      }
    }

    // Single-selection: existing behavior
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
  }, [canSendEditToAgent, sendSessionEditToAgent, saveCurrentToSession])

  const sendCommentToAgent = React.useCallback(async (id: string) => {
    const comment = stateRef.current.comments.find((c) => c.id === id)
    if (!comment) return false
    return sendSessionCommentToAgent(comment)
  }, [sendSessionCommentToAgent])

  const sendAllSessionItemsToAgent = React.useCallback(async () => {
    const items = getSessionItems()
    const current = stateRef.current

    // Collect multi-selected elements not already in the session
    const sessionElementSet = new Set(
      items.filter((i) => i.type === 'edit').map((i) => i.edit.element)
    )
    const contextOnlyLocators: ReturnType<typeof getElementLocator>[] = []
    if (current.selectedElements.length > 1) {
      for (const el of current.selectedElements) {
        if (!el.isConnected || sessionElementSet.has(el)) continue
        contextOnlyLocators.push(getElementLocator(el))
      }
    }

    if (items.length === 0 && contextOnlyLocators.length === 0) return false

    const allEdits = items.filter((i): i is { type: 'edit'; edit: SessionEdit } => i.type === 'edit').map(i => i.edit)
    const movePlanContext = buildMovePlanContext(allEdits)
    let moveEnvelopeSent = false

    let allSucceeded = true
    for (const item of items) {
      let succeeded: boolean
      if (item.type === 'edit') {
        const hasMoveIntent = Boolean(item.edit.move && getMoveIntentForEdit(item.edit, movePlanContext))
        const includeBatchMoveEnvelope = hasMoveIntent && !moveEnvelopeSent
        succeeded = await sendSessionEditToAgent(
          item.edit,
          allEdits,
          movePlanContext,
          { includeBatchMoveEnvelope },
        )
        if (includeBatchMoveEnvelope) moveEnvelopeSent = true
      } else {
        succeeded = await sendSessionCommentToAgent(item.comment)
      }
      if (!succeeded) {
        allSucceeded = false
      }
    }

    // Bundle multi-selected context-only elements into a single annotation
    if (contextOnlyLocators.length > 0) {
      const contextMarkdown = contextOnlyLocators
        .map((locator) => buildElementContext(locator))
        .join('\n\n')
      const primary = contextOnlyLocators[0]
      try {
        const result = await postEditToAgent({
          element: {
            tagName: primary.tagName,
            id: primary.id,
            classList: primary.classList,
            domSelector: primary.domSelector,
            targetHtml: primary.targetHtml,
            textPreview: primary.textPreview,
          },
          source: primary.domSource || null,
          reactStack: primary.reactStack,
          changes: [],
          textChange: null,
          moveIntent: null,
          exportMarkdown: contextMarkdown,
        })
        if (!result.ok) allSucceeded = false
      } catch {
        allSucceeded = false
      }
    }

    return allSucceeded
  }, [getSessionItems, sendSessionCommentToAgent, sendSessionEditToAgent])

  return {
    agentAvailable,
    canSendEditToAgent,
    sendEditToAgent,
    sendCommentToAgent,
    sendAllSessionItemsToAgent,
  }
}

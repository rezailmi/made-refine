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
  buildMovePlanContext,
  getMoveIntentForEdit,
  partitionMultiSelectedEdits,
  getContextOnlyBlocks,
} from './utils'
import type { ElementLocator } from './types'
import {
  checkAgentConnection,
  sendEditToAgent as postEditToAgent,
  sendCommentToAgent as postCommentToAgent,
} from './mcp-client'

function buildLocatorPayload(locator: ElementLocator) {
  return {
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
  }
}

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
        ...buildLocatorPayload(locator),
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
        ...buildLocatorPayload(comment.locator),
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
      const { editsWithChanges, contextBlocks } = partitionMultiSelectedEdits(
        current.selectedElements, sessionEditsRef,
      )
      if (editsWithChanges.length === 0 && contextBlocks.length === 0) return false

      const markdownParts: string[] = []
      if (editsWithChanges.length > 0) {
        const movePlanContext = buildMovePlanContext(editsWithChanges)
        markdownParts.push(buildSessionExport(editsWithChanges, [], { movePlanContext }))
      }
      markdownParts.push(...contextBlocks)
      const exportMarkdown = markdownParts.join('\n\n')

      const primaryEl = current.selectedElements.find((el) => el.isConnected)
      if (!primaryEl) return false
      const primary = getElementLocator(primaryEl)
      try {
        const result = await postEditToAgent({
          ...buildLocatorPayload(primary),
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
    const contextOnlyBlocks = getContextOnlyBlocks(current.selectedElements, items)

    if (items.length === 0 && contextOnlyBlocks.length === 0) return false

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
    if (contextOnlyBlocks.length > 0) {
      const primaryEl = current.selectedElements.find(
        (el) => el.isConnected && !allEdits.some((e) => e.element === el),
      )
      if (primaryEl) {
        try {
          const result = await postEditToAgent({
            ...buildLocatorPayload(getElementLocator(primaryEl)),
            changes: [],
            textChange: null,
            moveIntent: null,
            exportMarkdown: contextOnlyBlocks.join('\n\n'),
          })
          if (!result.ok) allSucceeded = false
        } catch {
          allSucceeded = false
        }
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

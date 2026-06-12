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
  buildExportInstruction,
  getExportContentProfile,
  getElementLocator,
  getLocatorHeader,
  formatComponentTree,
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
import type { ExportContentProfile } from './utils'

function withInstruction(profile: ExportContentProfile, markdown: string): string {
  const instruction = buildExportInstruction(profile)
  return instruction ? `${instruction}\n\n${markdown}` : markdown
}

function buildLocatorPayload(locator: ElementLocator) {
  const { componentLabel, formattedSource, formattedCallSite } = getLocatorHeader(locator)
  const reactTree = formatComponentTree(locator.reactStack)

  return {
    element: {
      tagName: locator.tagName,
      id: locator.id,
      classList: locator.classList,
      domSelector: locator.domSelector,
      targetHtml: locator.targetHtml,
      contextHtml: locator.domContextHtml || null,
      textPreview: locator.textPreview,
    },
    componentLabel,
    reactTree,
    reactStack: locator.reactStack,
    reactComponentName: locator.reactComponentName ?? null,
    authoredProps: locator.authoredProps ?? null,
    type: locator.isComponentPrimitive != null
      ? (locator.isComponentPrimitive ? 'component' : 'instance')
      : null,
    isComponentPrimitive: locator.isComponentPrimitive ?? false,
    source: formattedSource,
    callSite: formattedCallSite,
    rawSource: locator.domSource || null,
    callSiteSource: locator.callSiteSource ?? null,
    definitionSource: locator.definitionSource ?? null,
    subElementSources: locator.subElementSources ?? null,
  }
}

export interface AgentCommsOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  sessionEditsRef: React.MutableRefObject<Map<HTMLElement, SessionEdit>>
  getSessionItems: () => SessionItem[]
  saveCurrentToSession: () => void
  removeSessionEdit: (element: HTMLElement) => void
  deleteComment: (id: string) => void
}

export type SendFailure = {
  reason: 'unreachable' | 'rejected'
  failedEditElements: HTMLElement[]
  failedCommentIds: string[]
  at: number
}

export function useAgentComms({ stateRef, sessionEditsRef, getSessionItems, saveCurrentToSession, removeSessionEdit, deleteComment }: AgentCommsOptions) {
  const [agentAvailable, setAgentAvailable] = React.useState(false)
  const [lastSendFailure, setLastSendFailure] = React.useState<SendFailure | null>(null)
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
    options?: { includeBatchMoveEnvelope?: boolean; _isBatchCall?: boolean },
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

    const profile = getExportContentProfile(
      [sessionEdit],
      [],
      resolvedPlanContext,
    )

    try {
      // TODO(mcp-server): confirm ingest validation/DTOs accept the non-versioned moveIntent/movePlan schema.
      const result = await postEditToAgent({
        ...buildLocatorPayload(locator),
        changes,
        textChange: sessionEdit.textEdit ?? null,
        moveIntent,
        ...(movePlan ? { movePlan } : {}),
        exportMarkdown: withInstruction(profile, exportMarkdown),
      })
      if (result.ok) {
        removeSessionEdit(sessionEdit.element)
      } else if (!options?._isBatchCall && isMountedRef.current) {
        setLastSendFailure({
          reason: 'rejected',
          failedEditElements: [sessionEdit.element],
          failedCommentIds: [],
          at: Date.now(),
        })
      }
      return updateAgentAvailability(result.ok)
    } catch (err) {
      updateAgentAvailability(false)
      if (options?._isBatchCall) {
        throw err
      }
      if (isMountedRef.current) {
        setLastSendFailure({
          reason: 'unreachable',
          failedEditElements: [sessionEdit.element],
          failedCommentIds: [],
          at: Date.now(),
        })
      }
      return false
    }
  }, [updateAgentAvailability, removeSessionEdit])

  const sendSessionCommentToAgent = React.useCallback(async (comment: Comment, _options?: { _isBatchCall?: boolean }) => {
    const exportMarkdown = buildCommentExport(comment.locator, comment.text, comment.replies)
    const commentProfile: ExportContentProfile = { hasCssEdits: false, hasTextEdits: false, hasMoves: false, hasComments: true }

    try {
      const result = await postCommentToAgent({
        ...buildLocatorPayload(comment.locator),
        commentText: comment.text,
        replies: comment.replies,
        exportMarkdown: withInstruction(commentProfile, exportMarkdown),
      })
      if (result.ok) {
        deleteComment(comment.id)
      } else if (!_options?._isBatchCall && isMountedRef.current) {
        setLastSendFailure({
          reason: 'rejected',
          failedEditElements: [],
          failedCommentIds: [comment.id],
          at: Date.now(),
        })
      }
      return updateAgentAvailability(result.ok)
    } catch (err) {
      updateAgentAvailability(false)
      if (_options?._isBatchCall) {
        throw err
      }
      if (isMountedRef.current) {
        setLastSendFailure({
          reason: 'unreachable',
          failedEditElements: [],
          failedCommentIds: [comment.id],
          at: Date.now(),
        })
      }
      return false
    }
  }, [updateAgentAvailability, deleteComment])

  const sendEditToAgent = React.useCallback(async () => {
    // Clear any previous failure at the start of a new attempt
    if (isMountedRef.current) setLastSendFailure(null)

    const current = stateRef.current

    // Multi-selection: bundle all selected elements into a single annotation
    if (current.selectedElements.length > 1) {
      saveCurrentToSession()
      const { editsWithChanges, contextBlocks } = partitionMultiSelectedEdits(
        current.selectedElements, sessionEditsRef,
      )
      if (editsWithChanges.length === 0 && contextBlocks.length === 0) return false

      const markdownParts: string[] = []
      let movePlanCtx: ReturnType<typeof buildMovePlanContext> | null = null
      if (editsWithChanges.length > 0) {
        movePlanCtx = buildMovePlanContext(editsWithChanges)
        markdownParts.push(buildSessionExport(editsWithChanges, [], { movePlanContext: movePlanCtx }))
      }
      markdownParts.push(...contextBlocks)
      const exportMarkdown = markdownParts.join('\n\n')
      const multiProfile = getExportContentProfile(editsWithChanges, [], movePlanCtx)

      const primaryEl = current.selectedElements.find((el) => el.isConnected)
      if (!primaryEl) return false
      const primary = getElementLocator(primaryEl)
      try {
        const result = await postEditToAgent({
          ...buildLocatorPayload(primary),
          changes: [],
          textChange: null,
          moveIntent: null,
          exportMarkdown: withInstruction(multiProfile, exportMarkdown),
        })
        if (result.ok) {
          for (const el of current.selectedElements) {
            if (sessionEditsRef.current.has(el)) {
              removeSessionEdit(el)
            }
          }
        } else if (isMountedRef.current) {
          setLastSendFailure({
            reason: 'rejected',
            failedEditElements: editsWithChanges.map((e) => e.element),
            failedCommentIds: [],
            at: Date.now(),
          })
        }
        return updateAgentAvailability(result.ok)
      } catch {
        if (isMountedRef.current) {
          setLastSendFailure({
            reason: 'unreachable',
            failedEditElements: editsWithChanges.map((e) => e.element),
            failedCommentIds: [],
            at: Date.now(),
          })
        }
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
    // Clear any previous failure at the start of a new attempt
    if (isMountedRef.current) setLastSendFailure(null)
    const comment = stateRef.current.comments.find((c) => c.id === id)
    if (!comment) return false
    return sendSessionCommentToAgent(comment)
  }, [sendSessionCommentToAgent])

  const sendAllSessionItemsToAgent = React.useCallback(async () => {
    // Clear any previous failure at the start of a new attempt
    if (isMountedRef.current) setLastSendFailure(null)

    const items = getSessionItems()
    const current = stateRef.current
    const contextOnlyBlocks = getContextOnlyBlocks(current.selectedElements, items)

    if (items.length === 0 && contextOnlyBlocks.length === 0) return false

    const allEdits = items.filter((i): i is { type: 'edit'; edit: SessionEdit } => i.type === 'edit').map(i => i.edit)
    const movePlanContext = buildMovePlanContext(allEdits)
    let moveEnvelopeSent = false

    let allSucceeded = true
    const failedEditElements: HTMLElement[] = []
    const failedCommentIds: string[] = []
    let anyThrown = false

    for (const item of items) {
      let succeeded: boolean
      if (item.type === 'edit') {
        const hasMoveIntent = Boolean(item.edit.move && getMoveIntentForEdit(item.edit, movePlanContext))
        const includeBatchMoveEnvelope = hasMoveIntent && !moveEnvelopeSent
        try {
          succeeded = await sendSessionEditToAgent(
            item.edit,
            allEdits,
            movePlanContext,
            { includeBatchMoveEnvelope, _isBatchCall: true },
          )
          if (!succeeded) failedEditElements.push(item.edit.element)
        } catch {
          succeeded = false
          anyThrown = true
          failedEditElements.push(item.edit.element)
        }
        if (includeBatchMoveEnvelope) moveEnvelopeSent = true
      } else {
        try {
          succeeded = await sendSessionCommentToAgent(item.comment, { _isBatchCall: true })
          if (!succeeded) failedCommentIds.push(item.comment.id)
        } catch {
          succeeded = false
          anyThrown = true
          failedCommentIds.push(item.comment.id)
        }
      }
      if (!succeeded) {
        allSucceeded = false
      }
    }

    // Bundle multi-selected context-only elements into a single annotation
    let contextBlockFailed = false
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
          if (!result.ok) {
            allSucceeded = false
            contextBlockFailed = true
          }
        } catch {
          allSucceeded = false
          anyThrown = true
          contextBlockFailed = true
        }
      }
    }

    if (!allSucceeded && isMountedRef.current) {
      const reason: 'unreachable' | 'rejected' = anyThrown ? 'unreachable' : 'rejected'
      setLastSendFailure({
        reason,
        failedEditElements,
        failedCommentIds,
        at: Date.now(),
      })
    }

    return allSucceeded
  }, [getSessionItems, sendSessionCommentToAgent, sendSessionEditToAgent])

  const clearSendFailure = React.useCallback(() => {
    if (isMountedRef.current) setLastSendFailure(null)
  }, [])

  return {
    agentAvailable,
    lastSendFailure,
    clearSendFailure,
    canSendEditToAgent,
    sendEditToAgent,
    sendCommentToAgent,
    sendAllSessionItemsToAgent,
  }
}

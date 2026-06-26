import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEditState, useDirectEditActions } from './provider'
import { TooltipProvider } from './ui/tooltip'
import { cn } from './cn'
import type {
  SpacingPropertyKey,
  BorderRadiusPropertyKey,
  BorderPropertyKey,
  BorderProperties,
  CSSPropertyValue,
  SizingValue,
  SizingPropertyKey,
  ColorValue,
  ColorPropertyKey,
  TypographyPropertyKey,
  TypographyProperties,
  EffectsProperties,
  EffectsPropertyKey,
  BorderStyleControlPreference,
} from './types'
import { useMeasurement } from './use-measurement'
import { MeasurementOverlay } from './measurement-overlay'
import { useMove } from './use-move'
import type { StartDragOptions } from './use-move'
import { getStoredGuidelines } from './use-guidelines'
import {
  calculateGuidelineMeasurements,
  isFlexContainer,
  isTextElement,
  resolveElementTarget,
  computeHoverHighlight,
  elementFromPointWithoutOverlays,
  findChildAtPoint,
  getSelectionColors,
  parseColorValue,
  getElementDisplayName,
  invalidateColorTokenIndex,
} from './utils'
import { InteractionOverlay } from './panel/interaction-overlay'
import { SelectedCommentComposer } from './panel/selected-comment-composer'
import { MoveOverlay } from './move-overlay'
import { SelectionOverlay } from './selection-overlay'
import { MultiSelectionOverlay } from './multi-selection-overlay'
import { CommentOverlay } from './comment-overlay'
// Panel module imports
import { CollapsibleSection, SectionNav, useSectionNav } from './panel/shared'
import { BorderRadiusInputs } from './panel/border-radius-inputs'
import { BorderSection } from './panel/border-section'
import { ShadowSection } from './panel/shadow-section'
import { TypographyInputs } from './panel/typography-inputs'
import { FillSection, BackgroundFillSection } from './panel/fill-section'
import { EffectsSection } from './panel/effects-section'
import { PanelHeader } from './panel/panel-header'
import { PanelFooter } from './panel/panel-footer'
import { LayoutSection } from './panel/layout-section'
import { usePanelPosition, PANEL_WIDTH, PANEL_HEIGHT } from './use-panel-position'

// Re-export panel modules for external consumers
export {
  NumberInput,
  Tip,
  CollapsibleSection,
  SectionNav,
  useSectionNav,
  selectOnFocus,
} from './panel/shared'
export type { SectionKey } from './panel/shared'
export { SpacingInputs } from './panel/spacing-inputs'
export {
  BorderRadiusInputs,
  RadiusCornerIcon,
  BORDER_RADIUS_FULL,
  BORDER_RADIUS_SLIDER_MAX,
  sliderToValue,
  valueToSlider,
} from './panel/border-radius-inputs'
export {
  BorderSection,
  BorderInputs,
  BorderSideIcon,
  BORDER_STYLE_OPTIONS,
  BORDER_POSITION_OPTIONS,
  BORDER_SIDES,
  BORDER_SIDE_OPTIONS,
} from './panel/border-section'
export type { BorderPosition, BorderSideOption } from './panel/border-section'
export { ShadowSection, ShadowLayerEditor, ShadowField } from './panel/shadow-section'
export { TypographyInputs, FONT_FAMILIES, FONT_WEIGHTS } from './panel/typography-inputs'
export { FillSection, BackgroundFillSection, ColorInput } from './panel/fill-section'
export { EffectsSection } from './panel/effects-section'
export {
  SizingInputs,
  SizingDropdown,
  SizingFixedInput,
  SIZING_OPTIONS,
  DISTRIBUTE_MODES,
  DISTRIBUTE_LABELS,
} from './panel/sizing-inputs'
export type { DistributeMode } from './panel/sizing-inputs'
export { AlignmentGrid } from './panel/alignment-grid'

function getElementCommentAnchor(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + Math.min(16, Math.max(8, rect.height * 0.15)),
  }
}

function getPageFrameElement(element: HTMLElement): HTMLElement {
  return document.body.contains(element) ? document.body : element
}

export interface DirectEditPanelInnerProps {
  elementInfo: {
    tagName: string
    id: string | null
    classList: string[]
    isFlexContainer: boolean
    isFlexItem: boolean
    isTextElement: boolean
    parentElement: HTMLElement | null | boolean
    hasChildren: boolean
    isImageElement?: boolean
  }
  computedSpacing: {
    paddingTop: CSSPropertyValue
    paddingRight: CSSPropertyValue
    paddingBottom: CSSPropertyValue
    paddingLeft: CSSPropertyValue
    marginTop: CSSPropertyValue
    marginRight: CSSPropertyValue
    marginBottom: CSSPropertyValue
    marginLeft: CSSPropertyValue
    gap: CSSPropertyValue
  }
  computedBorderRadius: {
    borderTopLeftRadius: CSSPropertyValue
    borderTopRightRadius: CSSPropertyValue
    borderBottomRightRadius: CSSPropertyValue
    borderBottomLeftRadius: CSSPropertyValue
  }
  computedBorder: BorderProperties
  computedFlex: {
    flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
    justifyContent: string
    alignItems: string
    flexWrap: 'nowrap' | 'wrap' | 'wrap-reverse'
  }
  computedSizing: {
    width: SizingValue
    height: SizingValue
  } | null
  computedColor: {
    backgroundColor: ColorValue
    color: ColorValue
    borderColor: ColorValue
    outlineColor: ColorValue
  } | null
  selectionColors?: ColorValue[]
  computedBoxShadow?: string
  borderStyleControlPreference?: BorderStyleControlPreference
  computedTypography: TypographyProperties | null
  pendingStyles: Record<string, string>
  onClose?: () => void
  onSelectParent?: () => void
  onSelectChild?: () => void
  onUpdateSpacing: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
  onUpdateBorderRadius: (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => void
  onUpdateBorder: (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => void
  onBatchUpdateBorder: (
    changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>
  ) => void
  onSetCSS: (properties: Record<string, string>) => void
  onUpdateFlex: (
    key: 'flexDirection' | 'justifyContent' | 'alignItems' | 'flexWrap',
    value: string
  ) => void
  onToggleFlex: () => void
  onUpdateSizing: (key: SizingPropertyKey, value: SizingValue) => void
  onUpdateColor: (key: ColorPropertyKey, value: ColorValue) => void
  onReplaceSelectionColor: (from: ColorValue, to: ColorValue) => void
  onSelectSelectionColorTarget?: (color: ColorValue) => void
  onUpdateTypography: (key: TypographyPropertyKey, value: CSSPropertyValue | string) => void
  computedEffects?: EffectsProperties | null
  onUpdateEffects?: (key: EffectsPropertyKey, value: number | string) => void
  onReset: () => void
  onExportEdits?: () => Promise<boolean>
  onSendToAgent?: () => Promise<boolean>
  canSendToAgent?: boolean
  showSendButton?: boolean
  sendFailureReason?: 'unreachable' | 'rejected' | null
  className?: string
  style?: React.CSSProperties
  panelRef?: React.RefObject<HTMLDivElement>
  isDragging?: boolean
  onHeaderPointerDown?: (e: React.PointerEvent) => void
  onHeaderPointerMove?: (e: React.PointerEvent) => void
  onHeaderPointerUp?: (e: React.PointerEvent) => void
  onHeaderPointerCancel?: (e: React.PointerEvent) => void
}

export function DirectEditPanelInner({
  elementInfo,
  computedSpacing,
  computedBorderRadius,
  computedBorder,
  computedFlex,
  computedSizing,
  computedColor,
  selectionColors = [],
  computedBoxShadow = 'none',
  borderStyleControlPreference = 'icon',
  computedTypography,
  computedEffects,
  pendingStyles,
  onClose,
  onSelectParent,
  onSelectChild,
  onUpdateSpacing,
  onUpdateBorderRadius,
  onUpdateBorder,
  onBatchUpdateBorder,
  onSetCSS,
  onUpdateFlex,
  onToggleFlex,
  onUpdateSizing,
  onUpdateColor,
  onReplaceSelectionColor,
  onSelectSelectionColorTarget,
  onUpdateTypography,
  onUpdateEffects,
  onExportEdits,
  onSendToAgent,
  canSendToAgent = false,
  showSendButton = true,
  sendFailureReason,
  className,
  style,
  panelRef,
  isDragging,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
  onHeaderPointerCancel,
}: DirectEditPanelInnerProps) {
  const hasPendingChanges = Object.keys(pendingStyles).length > 0
  const canTriggerSend = canSendToAgent || hasPendingChanges
  const isDraggable = onHeaderPointerDown !== undefined

  const layoutSectionRef = React.useRef<HTMLDivElement>(null)
  const radiusSectionRef = React.useRef<HTMLDivElement>(null)
  const borderSectionRef = React.useRef<HTMLDivElement>(null)
  const shadowSectionRef = React.useRef<HTMLDivElement>(null)
  const fillSectionRef = React.useRef<HTMLDivElement>(null)
  const colorsSectionRef = React.useRef<HTMLDivElement>(null)
  const textSectionRef = React.useRef<HTMLDivElement>(null)
  const effectsSectionRef = React.useRef<HTMLDivElement>(null)
  const sectionRefs = React.useMemo(
    () => ({
      layout: layoutSectionRef,
      radius: radiusSectionRef,
      border: borderSectionRef,
      shadow: shadowSectionRef,
      fill: fillSectionRef,
      colors: colorsSectionRef,
      text: textSectionRef,
      effects: effectsSectionRef,
    }),
    []
  )
  const { scrollRef, activeSection } = useSectionNav(sectionRefs)

  // Re-read the host app's design tokens when the selected element changes, so a
  // stale module-level color-token index never sticks (e.g. after a theme toggle).
  React.useEffect(() => {
    invalidateColorTokenIndex()
  }, [elementInfo])

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={panelRef}
        data-direct-edit="panel"
        className={cn(
          'flex flex-col overflow-hidden rounded-xl outline outline-1 outline-foreground/10 shadow-lg transition-shadow duration-200',
          isDragging && 'cursor-grabbing select-none shadow-2xl',
          className
        )}
        style={{
          width: PANEL_WIDTH,
          ...(isDragging && { transition: 'box-shadow 150ms ease-out' }),
          ...style,
        }}
      >
        <PanelHeader
          elementInfo={elementInfo}
          isDraggable={isDraggable}
          onClose={onClose}
          onSelectParent={onSelectParent}
          onSelectChild={onSelectChild}
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerCancel}
        />

        <SectionNav
          scrollRef={scrollRef}
          activeSection={activeSection}
          showColors={!!computedColor}
          showText={elementInfo.isTextElement && !!computedTypography}
          showEffects={!!computedEffects && !!onUpdateEffects}
          sectionRefs={sectionRefs}
        />

        <div
          className="flex-1 overflow-y-auto backdrop-blur-xl bg-background/85"
          ref={scrollRef}
          onWheelCapture={(e) => e.stopPropagation()}
        >
          <LayoutSection
            elementInfo={elementInfo}
            computedFlex={computedFlex}
            computedSpacing={computedSpacing}
            computedSizing={computedSizing}
            onToggleFlex={onToggleFlex}
            onUpdateFlex={onUpdateFlex}
            onUpdateSpacing={onUpdateSpacing}
            onUpdateSizing={onUpdateSizing}
            overflow={computedEffects?.overflow}
            onUpdateOverflow={
              computedEffects && onUpdateEffects
                ? (value) => onUpdateEffects('overflow', value)
                : undefined
            }
            sectionRef={layoutSectionRef}
          />

          <div ref={radiusSectionRef}>
            <CollapsibleSection title="Radius">
              <BorderRadiusInputs
                values={{
                  topLeft: computedBorderRadius.borderTopLeftRadius,
                  topRight: computedBorderRadius.borderTopRightRadius,
                  bottomRight: computedBorderRadius.borderBottomRightRadius,
                  bottomLeft: computedBorderRadius.borderBottomLeftRadius,
                }}
                onChange={onUpdateBorderRadius}
              />
            </CollapsibleSection>
          </div>

          {computedColor && (
            <div ref={fillSectionRef}>
              <BackgroundFillSection
                backgroundColor={computedColor.backgroundColor}
                onSetCSS={onSetCSS}
                pendingStyles={pendingStyles}
                classList={elementInfo.classList}
              />
            </div>
          )}

          <div ref={borderSectionRef}>
            <BorderSection
              border={computedBorder}
              borderColor={computedColor?.borderColor}
              outlineColor={computedColor?.outlineColor}
              borderStyleControlPreference={borderStyleControlPreference}
              onChange={onUpdateBorder}
              onBatchChange={onBatchUpdateBorder}
              onBorderColorChange={(value) => onUpdateColor('borderColor', value)}
              onOutlineColorChange={(value) => onUpdateColor('outlineColor', value)}
              onSetCSS={onSetCSS}
              pendingStyles={pendingStyles}
              classList={elementInfo.classList}
            />
          </div>

          <div ref={shadowSectionRef}>
            <ShadowSection
              boxShadow={computedBoxShadow}
              onSetCSS={onSetCSS}
              pendingStyles={pendingStyles}
            />
          </div>

          {elementInfo.isTextElement && computedTypography && (
            <div ref={textSectionRef}>
              <CollapsibleSection title="Text">
                <TypographyInputs typography={computedTypography} onUpdate={onUpdateTypography} />
              </CollapsibleSection>
            </div>
          )}

          {computedEffects && onUpdateEffects && (
            <div ref={effectsSectionRef}>
              <CollapsibleSection title="Effects">
                <EffectsSection
                  effects={computedEffects}
                  elementInfo={{ isImageElement: elementInfo.isImageElement ?? false }}
                  onUpdate={onUpdateEffects}
                />
              </CollapsibleSection>
            </div>
          )}

          {computedColor && (
            <div ref={colorsSectionRef}>
              <CollapsibleSection title="Selection colors">
                <FillSection
                  textColor={computedColor.color}
                  borderColor={computedColor.borderColor}
                  outlineColor={computedColor.outlineColor}
                  selectionColors={selectionColors}
                  onTextChange={(value) => onUpdateColor('color', value)}
                  onBorderColorChange={(value) => onUpdateColor('borderColor', value)}
                  onOutlineColorChange={(value) => onUpdateColor('outlineColor', value)}
                  onSelectionColorChange={onReplaceSelectionColor}
                  onSelectionColorTarget={onSelectSelectionColorTarget}
                  hasTextContent={elementInfo.isTextElement}
                  showBorderColor={computedColor.borderColor.alpha > 0}
                  showOutlineColor={computedColor.outlineColor.alpha > 0}
                  classList={elementInfo.classList}
                />
              </CollapsibleSection>
            </div>
          )}
        </div>

        {(onExportEdits || (showSendButton && onSendToAgent)) && (
          <PanelFooter
            isDraggable={isDraggable}
            canTriggerSend={canTriggerSend}
            onExportEdits={onExportEdits}
            onSendToAgent={onSendToAgent}
            showSendButton={showSendButton}
            sendFailureReason={sendFailureReason}
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
            onPointerCancel={onHeaderPointerCancel}
          />
        )}
      </div>
    </TooltipProvider>
  )
}

function DirectEditPanelContent() {
  const container = usePortalContainer()
  const {
    isOpen,
    elementInfo,
    computedSpacing,
    computedBorderRadius,
    computedBorder,
    computedFlex,
    computedSizing,
    computedColor,
    computedBoxShadow,
    computedTypography,
    computedEffects,
    isComponentPrimitive,
    borderStyleControlPreference,
    pendingStyles,
    editModeActive,
    selectedElement,
    selectedElements,
    selectionAnchorElement,
    canvas,
    comments,
    activeCommentId,
    textEditingElement,
    agentAvailable,
    lastSendFailure,
  } = useDirectEditState()
  const {
    selectParent,
    selectChild,
    selectElement,
    selectElements: setSelectedElements,
    toggleElementSelection,
    clearSelection,
    updateSpacingProperty,
    updateBorderRadiusProperty,
    updateBorderProperty,
    updateBorderProperties,
    updateRawCSS,
    updateFlexProperty,
    toggleFlexLayout,
    updateSizingProperties,
    updateSizingProperty,
    updateColorProperty,
    replaceSelectionColor,
    updateTypographyProperty,
    updateEffectProperty,
    resetToOriginal,
    handleMoveComplete,
    addComment,
    submitCommentDraft,
    addCommentReply,
    deleteComment,
    exportComment,
    exportEdits,
    sendEditToAgent,
    sendCommentToAgent,
    setActiveCommentId,
    startTextEditing,
    toggleEditMode,
    setCommentDraftText,
    setCommentDraftBlockedHandler,
  } = useDirectEditActions()

  const {
    position,
    isDragging,
    isSnapping,
    panelRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = usePanelPosition()

  const [hoverHighlight, setHoverHighlight] = React.useState<{
    flexContainer: HTMLElement
    children: HTMLElement[]
  } | null>(null)
  const [commentInputAttention, setCommentInputAttention] = React.useState<{
    commentId: string
    nonce: number
  } | null>(null)
  const commentDraftRef = React.useRef('')
  const commentTargetElement = selectedElement ?? selectionAnchorElement
  const previousCommentTriggerRef = React.useRef<{
    editModeActive: boolean
    commentTargetElement: HTMLElement | null
  }>({
    editModeActive,
    commentTargetElement,
  })

  React.useEffect(() => {
    commentDraftRef.current = ''
    setCommentDraftText('')
  }, [activeCommentId, setCommentDraftText])

  const activeDraftComment = React.useMemo(() => {
    if (!commentTargetElement || !activeCommentId) return null
    const active = comments.find((comment) => comment.id === activeCommentId)
    if (!active || active.text.trim().length > 0 || active.element !== commentTargetElement)
      return null
    return active
  }, [activeCommentId, commentTargetElement, comments])

  const {
    isActive: measurementActive,
    hoveredElement,
    measurements,
    mousePosition,
  } = useMeasurement(isOpen ? selectedElement : null)

  const { dragState, dropIndicator, startDrag } = useMove({
    onMoveComplete: handleMoveComplete,
  })

  const triggerCommentInputAttention = React.useCallback((commentId: string) => {
    setCommentInputAttention((prev) =>
      prev?.commentId === commentId ? { commentId, nonce: prev.nonce + 1 } : { commentId, nonce: 1 }
    )
  }, [])

  React.useEffect(() => {
    if (!activeCommentId) {
      setCommentDraftBlockedHandler(null)
      return
    }

    setCommentDraftBlockedHandler(() => {
      triggerCommentInputAttention(activeCommentId)
    })

    return () => {
      setCommentDraftBlockedHandler(null)
    }
  }, [activeCommentId, setCommentDraftBlockedHandler, triggerCommentInputAttention])

  const hasPendingCommentDraft = React.useCallback(
    (nextCommentId: string | null = null) => {
      if (!activeCommentId) return false
      if (nextCommentId && nextCommentId === activeCommentId) return false
      const active = comments.find((comment) => comment.id === activeCommentId)
      if (!active) return false
      // Block only unsent drafts (typed input not yet submitted to comment.text).
      const hasUnsentDraft =
        active.text.trim().length === 0 && commentDraftRef.current.trim().length > 0
      if (!hasUnsentDraft) return false
      triggerCommentInputAttention(active.id)
      return true
    },
    [activeCommentId, comments, triggerCommentInputAttention]
  )

  const handleSetActiveComment = React.useCallback(
    (id: string | null) => {
      if (hasPendingCommentDraft(id)) return
      // Delete empty comment when switching away
      if (activeCommentId && activeCommentId !== id) {
        const active = comments.find((comment) => comment.id === activeCommentId)
        if (active && active.text.trim().length === 0) {
          deleteComment(active.id)
        }
      }
      setActiveCommentId(id)
    },
    [activeCommentId, comments, hasPendingCommentDraft, deleteComment, setActiveCommentId]
  )

  const handleCommentPillClick = React.useCallback(() => {
    if (activeDraftComment) {
      handleSetActiveComment(null)
      return
    }
    if (hasPendingCommentDraft()) return
    if (!commentTargetElement) return

    const existingDraft = comments.find(
      (comment) => comment.element === commentTargetElement && comment.text.trim().length === 0
    )

    if (existingDraft) {
      setActiveCommentId(existingDraft.id)
      return
    }

    addComment(commentTargetElement, getElementCommentAnchor(commentTargetElement))
  }, [
    activeDraftComment,
    handleSetActiveComment,
    hasPendingCommentDraft,
    commentTargetElement,
    comments,
    setActiveCommentId,
    addComment,
  ])

  React.useEffect(() => {
    const previous = previousCommentTriggerRef.current
    previousCommentTriggerRef.current = { editModeActive, commentTargetElement }

    if (!editModeActive || textEditingElement) return

    const changedSelection = previous.commentTargetElement !== commentTargetElement

    if (!changedSelection) return

    if (!commentTargetElement) {
      if (!activeCommentId) return
      const active = comments.find((comment) => comment.id === activeCommentId)
      if (active && active.text.trim().length === 0) {
        deleteComment(active.id)
      }
      setActiveCommentId(null)
      return
    }

    // Clean up orphaned empty drafts when selection changes
    if (activeCommentId) {
      const active = comments.find((comment) => comment.id === activeCommentId)
      if (active && active.text.trim().length === 0 && active.element !== commentTargetElement) {
        deleteComment(active.id)
        setActiveCommentId(null)
      }
    }
  }, [
    activeCommentId,
    commentTargetElement,
    comments,
    deleteComment,
    editModeActive,
    setActiveCommentId,
    textEditingElement,
  ])

  const overlay =
    editModeActive && container
      ? createPortal(
          <InteractionOverlay
            selectedElement={selectedElement}
            selectedElements={selectedElements}
            textEditingElement={textEditingElement}
            activeCommentId={activeCommentId}
            hoverHighlight={hoverHighlight}
            onSelectElement={selectElement}
            onSelectElements={setSelectedElements}
            onToggleElementSelection={toggleElementSelection}
            onClearSelection={clearSelection}
            onStartTextEditing={startTextEditing}
            onAddComment={addComment}
            onSetActiveCommentId={handleSetActiveComment}
            onSetHoverHighlight={setHoverHighlight}
            hasPendingCommentDraft={hasPendingCommentDraft}
          />,
          container
        )
      : null

  const commentOverlay =
    editModeActive && comments.length > 0 && container
      ? createPortal(
          <CommentOverlay
            comments={comments.filter((comment) => comment.text.trim().length > 0)}
            activeCommentId={activeCommentId}
            onSetActiveComment={handleSetActiveComment}
            onAddReply={addCommentReply}
            onDelete={deleteComment}
            onExport={exportComment}
            onSendToAgent={agentAvailable ? sendCommentToAgent : undefined}
          />,
          container
        )
      : null

  const selectedCommentComposer =
    editModeActive && activeDraftComment && container
      ? createPortal(
          <SelectedCommentComposer
            comment={activeDraftComment}
            attentionNonce={
              commentInputAttention?.commentId === activeDraftComment.id
                ? commentInputAttention.nonce
                : 0
            }
            draftRef={commentDraftRef}
            onDraftTextChange={setCommentDraftText}
            onSubmit={(text) => submitCommentDraft(activeDraftComment.id, text)}
            onCancel={() => handleSetActiveComment(null)}
          />,
          container
        )
      : null

  const selectionColors = React.useMemo(() => {
    if (!selectedElement) return []
    return getSelectionColors(selectedElement)
  }, [selectedElement, pendingStyles])

  const pageFrameElement = React.useMemo(() => {
    if (!selectedElement) return null
    return getPageFrameElement(selectedElement)
  }, [selectedElement])

  const pageFrameLabel = React.useMemo(() => {
    if (!pageFrameElement) return null
    const pageTitle = document.title.trim()
    if (pageTitle.length > 0) return pageTitle
    return getElementDisplayName(pageFrameElement)
  }, [pageFrameElement])

  const handleSelectSelectionColorTarget = React.useCallback(
    (targetColor: ColorValue) => {
      if (!selectedElement) return

      const toKey = (color: ColorValue) => `${color.hex.toUpperCase()}:${Math.round(color.alpha)}`
      const targetKey = toKey(targetColor)
      const hasOwnText = (node: Element) =>
        Array.from(node.childNodes).some(
          (child) =>
            child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim().length > 0
        )
      const parseVisibleColor = (raw: string, fallbackCurrentColor?: string): ColorValue | null => {
        const trimmed = raw.trim()
        if (!trimmed || trimmed === 'none' || trimmed === 'transparent') return null
        const resolved =
          trimmed.toLowerCase() === 'currentcolor' ? (fallbackCurrentColor ?? trimmed) : trimmed
        const parsed = parseColorValue(resolved)
        return parsed.alpha > 0 ? parsed : null
      }
      const hasMatchingColor = (node: Element): boolean => {
        const computed = window.getComputedStyle(node)
        const currentTextColor = computed.color

        const matches = (raw: string, fallback?: string): boolean => {
          const parsed = parseVisibleColor(raw, fallback)
          return Boolean(parsed && toKey(parsed) === targetKey)
        }

        if (matches(computed.backgroundColor)) return true
        if (hasOwnText(node) && matches(currentTextColor)) return true

        const borderSides = [
          {
            style: computed.borderTopStyle,
            width: computed.borderTopWidth,
            color: computed.borderTopColor,
          },
          {
            style: computed.borderRightStyle,
            width: computed.borderRightWidth,
            color: computed.borderRightColor,
          },
          {
            style: computed.borderBottomStyle,
            width: computed.borderBottomWidth,
            color: computed.borderBottomColor,
          },
          {
            style: computed.borderLeftStyle,
            width: computed.borderLeftWidth,
            color: computed.borderLeftColor,
          },
        ]
        for (const side of borderSides) {
          if (
            side.style !== 'none' &&
            parseFloat(side.width) > 0 &&
            matches(side.color, currentTextColor)
          ) {
            return true
          }
        }

        if (
          computed.outlineStyle !== 'none' &&
          parseFloat(computed.outlineWidth) > 0 &&
          matches(computed.outlineColor, currentTextColor)
        ) {
          return true
        }

        if (node instanceof SVGGraphicsElement) {
          const fillMatch =
            matches(computed.getPropertyValue('fill'), currentTextColor) ||
            matches(node.getAttribute('fill') ?? '', currentTextColor)
          const strokeMatch =
            matches(computed.getPropertyValue('stroke'), currentTextColor) ||
            matches(node.getAttribute('stroke') ?? '', currentTextColor)
          if (fillMatch || strokeMatch) return true
        }

        return false
      }

      const descendants = Array.from(selectedElement.querySelectorAll('*'))
      const firstDescendantMatch = descendants.find(
        (node) => node instanceof HTMLElement && hasMatchingColor(node)
      ) as HTMLElement | undefined

      if (firstDescendantMatch) {
        selectElement(firstDescendantMatch)
        return
      }

      if (hasMatchingColor(selectedElement)) {
        selectElement(selectedElement)
      }
    },
    [selectedElement, selectElement]
  )

  const handleMoveStart = (
    e: React.PointerEvent,
    targetElement?: HTMLElement,
    options?: StartDragOptions
  ) => {
    const elementToDrag = targetElement ?? selectedElement
    if (elementToDrag) {
      startDrag(e, elementToDrag, options)
    }
  }

  const hasMultiItemFlexAncestor = (() => {
    if (!selectedElement) return false

    let current: HTMLElement | null = selectedElement.parentElement
    while (current) {
      if (isFlexContainer(current) && current.children.length > 1) {
        return true
      }
      current = current.parentElement
    }

    return false
  })()

  const showMoveHandle = Boolean(
    selectedElement &&
    ((isFlexContainer(selectedElement) && selectedElement.children.length > 1) ||
      hasMultiItemFlexAncestor)
  )

  const selectionChromeContent = selectedElement ? (
    <SelectionOverlay
      selectedElement={selectedElement}
      pageFrameElement={pageFrameElement}
      pageFrameLabel={pageFrameLabel}
      canvasZoom={canvas?.zoom ?? 1}
      draggedElement={dragState.draggedElement}
      isDragging={dragState.isDragging}
      ghostPosition={dragState.ghostPosition}
      onMoveStart={handleMoveStart}
      showMoveHandle={showMoveHandle}
      isTextEditing={Boolean(textEditingElement)}
      onDoubleClick={(clientX, clientY) => {
        if (!selectedElement) return
        if (isTextElement(selectedElement)) {
          startTextEditing(selectedElement)
          return
        }
        const elementUnder = elementFromPointWithoutOverlays(clientX, clientY)
        if (
          elementUnder &&
          elementUnder !== selectedElement &&
          selectedElement.contains(elementUnder)
        ) {
          const resolved = resolveElementTarget(elementUnder, selectedElement)
          if (isTextElement(resolved)) {
            selectElement(resolved)
            startTextEditing(resolved)
          }
        }
      }}
      onHoverElement={(element) => {
        setHoverHighlight(computeHoverHighlight(element, selectedElement))
      }}
      onSelectPageFrame={selectElement}
      onClickThrough={(clientX, clientY) => {
        if (!selectedElement) return
        if (hasPendingCommentDraft()) return
        if (activeCommentId) {
          handleSetActiveComment(null)
        }
        const elementUnder = elementFromPointWithoutOverlays(clientX, clientY)
        if (!elementUnder) return
        if (elementUnder !== selectedElement && selectedElement.contains(elementUnder)) {
          const resolved = resolveElementTarget(elementUnder, selectedElement)
          selectElement(resolved)
          return
        }
        const child = findChildAtPoint(selectedElement, clientX, clientY)
        if (child) {
          selectElement(child)
        }
      }}
      isComponentPrimitive={isComponentPrimitive}
      enableResizeHandles={true}
      onResizeSizingChange={updateSizingProperties}
      showCommentPill={editModeActive}
      isCommentActive={Boolean(activeDraftComment)}
      onCommentPillClick={handleCommentPillClick}
    />
  ) : selectedElements.length > 1 && !textEditingElement ? (
    <MultiSelectionOverlay selectedElements={selectedElements} />
  ) : null

  const selectionChrome =
    selectionChromeContent && container ? createPortal(selectionChromeContent, container) : null

  const moveChrome =
    dragState.isDragging && container
      ? createPortal(<MoveOverlay dropIndicator={dropIndicator} />, container)
      : null

  const measurementChrome =
    measurementActive && selectedElement && container
      ? createPortal(
          <MeasurementOverlay
            selectedElement={selectedElement}
            hoveredElement={hoveredElement}
            measurements={[
              ...measurements,
              ...calculateGuidelineMeasurements(
                selectedElement,
                getStoredGuidelines(),
                mousePosition
              ),
            ]}
          />,
          container
        )
      : null

  if (
    !isOpen ||
    !computedSpacing ||
    !elementInfo ||
    !computedBorderRadius ||
    !computedBorder ||
    !computedFlex ||
    !computedSizing ||
    !computedColor ||
    computedBoxShadow === null ||
    !computedTypography ||
    computedEffects === null ||
    !container
  ) {
    return (
      <>
        {overlay}
        {commentOverlay}
        {selectedCommentComposer}
        {selectionChrome}
        {moveChrome}
        {measurementChrome}
      </>
    )
  }

  return createPortal(
    <>
      {overlay}
      {commentOverlay}
      {selectedCommentComposer}
      {selectionChrome}
      {moveChrome}
      {measurementChrome}

      <DirectEditPanelInner
        elementInfo={elementInfo}
        computedSpacing={computedSpacing}
        computedBorderRadius={computedBorderRadius}
        computedBorder={computedBorder}
        computedFlex={computedFlex}
        computedSizing={computedSizing}
        computedColor={computedColor}
        selectionColors={selectionColors}
        computedBoxShadow={computedBoxShadow}
        borderStyleControlPreference={borderStyleControlPreference}
        computedTypography={computedTypography}
        computedEffects={computedEffects}
        pendingStyles={pendingStyles}
        onClose={toggleEditMode}
        onSelectParent={selectParent}
        onSelectChild={selectChild}
        onUpdateSpacing={updateSpacingProperty}
        onUpdateBorderRadius={updateBorderRadiusProperty}
        onUpdateBorder={updateBorderProperty}
        onBatchUpdateBorder={updateBorderProperties}
        onSetCSS={updateRawCSS}
        onUpdateFlex={updateFlexProperty}
        onToggleFlex={toggleFlexLayout}
        onUpdateSizing={updateSizingProperty}
        onUpdateColor={updateColorProperty}
        onReplaceSelectionColor={replaceSelectionColor}
        onSelectSelectionColorTarget={handleSelectSelectionColorTarget}
        onUpdateTypography={updateTypographyProperty}
        onUpdateEffects={updateEffectProperty}
        onReset={resetToOriginal}
        onExportEdits={exportEdits}
        onSendToAgent={agentAvailable ? sendEditToAgent : undefined}
        sendFailureReason={lastSendFailure?.reason ?? null}
        className="fixed z-[99999]"
        style={{
          left: position.x,
          top: position.y,
          maxHeight: PANEL_HEIGHT,
          pointerEvents: 'auto',
          ...(isSnapping && {
            transition:
              'left 300ms cubic-bezier(0.34, 1.56, 0.64, 1), top 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }),
        }}
        panelRef={panelRef}
        isDragging={isDragging}
        onHeaderPointerDown={handlePointerDown}
        onHeaderPointerMove={handlePointerMove}
        onHeaderPointerUp={handlePointerUp}
        onHeaderPointerCancel={handlePointerCancel}
      />
    </>,
    container
  )
}

export function DirectEditPanel() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <DirectEditPanelContent />
}

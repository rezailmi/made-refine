import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEditState, useDirectEditActions } from './provider'
import {
  TooltipProvider,
} from './ui/tooltip'
import { cn } from './cn'
import type { SpacingPropertyKey, BorderRadiusPropertyKey, BorderPropertyKey, BorderProperties, CSSPropertyValue, SizingValue, SizingPropertyKey, ColorValue, ColorPropertyKey, TypographyPropertyKey, TypographyProperties, BorderStyleControlPreference } from './types'
import { useMeasurement } from './use-measurement'
import { MeasurementOverlay } from './measurement-overlay'
import { useMove } from './use-move'
import { getStoredGuidelines } from './use-guidelines'
import {
  calculateGuidelineMeasurements, isFlexContainer, isTextElement,
  resolveElementTarget, computeHoverHighlight,
  elementFromPointWithoutOverlays, findChildAtPoint,
} from './utils'
import { InteractionOverlay } from './panel/interaction-overlay'
import { MoveOverlay } from './move-overlay'
import { SelectionOverlay } from './selection-overlay'
import { CommentOverlay } from './comment-overlay'
// Panel module imports
import { NumberInput, Tip, CollapsibleSection, SectionNav, useSectionNav } from './panel/shared'
import type { SectionKey } from './panel/shared'
import { BorderRadiusInputs } from './panel/border-radius-inputs'
import { BorderSection } from './panel/border-section'
import { ShadowSection } from './panel/shadow-section'
import { TypographyInputs } from './panel/typography-inputs'
import { FillSection } from './panel/fill-section'
import { PanelHeader } from './panel/panel-header'
import { PanelFooter } from './panel/panel-footer'
import { LayoutSection } from './panel/layout-section'
import { usePanelPosition, PANEL_WIDTH, PANEL_HEIGHT } from './use-panel-position'

// Re-export panel modules for external consumers
export { NumberInput, Tip, CollapsibleSection, SectionNav, useSectionNav, selectOnFocus } from './panel/shared'
export type { SectionKey } from './panel/shared'
export { SpacingInputs } from './panel/spacing-inputs'
export { BorderRadiusInputs, RadiusCornerIcon, BORDER_RADIUS_FULL, BORDER_RADIUS_SLIDER_MAX, sliderToValue, valueToSlider } from './panel/border-radius-inputs'
export { BorderSection, BorderInputs, BorderSideIcon, BORDER_STYLE_OPTIONS, BORDER_POSITION_OPTIONS, BORDER_SIDES, BORDER_SIDE_OPTIONS } from './panel/border-section'
export type { BorderPosition, BorderSideOption } from './panel/border-section'
export { ShadowSection, ShadowLayerEditor, ShadowField } from './panel/shadow-section'
export { TypographyInputs, FONT_FAMILIES, FONT_WEIGHTS } from './panel/typography-inputs'
export { FillSection, ColorInput } from './panel/fill-section'
export { SizingInputs, SizingDropdown, SizingFixedInput, SIZING_OPTIONS, DISTRIBUTE_MODES, DISTRIBUTE_LABELS } from './panel/sizing-inputs'
export type { DistributeMode } from './panel/sizing-inputs'
export { AlignmentGrid } from './panel/alignment-grid'

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
  onBatchUpdateBorder: (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => void
  onSetCSS: (properties: Record<string, string>) => void
  onUpdateFlex: (key: 'flexDirection' | 'justifyContent' | 'alignItems', value: string) => void
  onToggleFlex: () => void
  onUpdateSizing: (key: SizingPropertyKey, value: SizingValue) => void
  onUpdateColor: (key: ColorPropertyKey, value: ColorValue) => void
  onUpdateTypography: (key: TypographyPropertyKey, value: CSSPropertyValue | string) => void
  onReset: () => void
  onExportEdits: () => Promise<boolean>
  onSendToAgent: () => Promise<boolean>
  canSendToAgent?: boolean
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
  computedBoxShadow = 'none',
  borderStyleControlPreference = 'icon',
  computedTypography,
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
  onUpdateTypography,
  onReset,
  onExportEdits,
  onSendToAgent,
  canSendToAgent = false,
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

  const sectionRefs = {
    layout: React.useRef<HTMLDivElement>(null),
    radius: React.useRef<HTMLDivElement>(null),
    border: React.useRef<HTMLDivElement>(null),
    shadow: React.useRef<HTMLDivElement>(null),
    colors: React.useRef<HTMLDivElement>(null),
    text: React.useRef<HTMLDivElement>(null),
  }
  const { scrollRef, activeSection } = useSectionNav(sectionRefs)

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
        ...(isDragging && { transform: 'rotate(0.5deg) scale(1.01)', transition: 'transform 150ms ease-out, box-shadow 150ms ease-out' }),
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
        sectionRefs={sectionRefs}
      />

      <div className="flex-1 overflow-y-auto backdrop-blur-xl bg-background/85" ref={scrollRef} onWheelCapture={(e) => e.stopPropagation()}>
        <LayoutSection
          elementInfo={elementInfo}
          computedFlex={computedFlex}
          computedSpacing={computedSpacing}
          computedSizing={computedSizing}
          onToggleFlex={onToggleFlex}
          onUpdateFlex={onUpdateFlex}
          onUpdateSpacing={onUpdateSpacing}
          onUpdateSizing={onUpdateSizing}
          sectionRef={sectionRefs.layout}
        />

        <div ref={sectionRefs.radius}>
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

        <div ref={sectionRefs.border}>
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
          />
        </div>

        <div ref={sectionRefs.shadow}>
          <ShadowSection
            boxShadow={computedBoxShadow}
            onSetCSS={onSetCSS}
            pendingStyles={pendingStyles}
          />
        </div>

        {elementInfo.isTextElement && computedTypography && (
          <div ref={sectionRefs.text}>
            <CollapsibleSection title="Text">
              <TypographyInputs
                typography={computedTypography}
                onUpdate={onUpdateTypography}
              />
            </CollapsibleSection>
          </div>
        )}

        {computedColor && (
          <div ref={sectionRefs.colors}>
            <CollapsibleSection title="Selection colors">
              <FillSection
                backgroundColor={computedColor.backgroundColor}
                textColor={computedColor.color}
                borderColor={computedColor.borderColor}
                outlineColor={computedColor.outlineColor}
                onBackgroundChange={(value) => onUpdateColor('backgroundColor', value)}
                onTextChange={(value) => onUpdateColor('color', value)}
                onBorderColorChange={(value) => onUpdateColor('borderColor', value)}
                onOutlineColorChange={(value) => onUpdateColor('outlineColor', value)}
                hasTextContent={elementInfo.isTextElement}
                showBackgroundColor={computedColor.backgroundColor.alpha > 0}
                showBorderColor={false}
                showOutlineColor={computedColor.outlineColor.alpha > 0}
              />
            </CollapsibleSection>
          </div>
        )}
      </div>

      <PanelFooter
        isDraggable={isDraggable}
        canTriggerSend={canTriggerSend}
        onExportEdits={onExportEdits}
        onSendToAgent={onSendToAgent}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerCancel}
      />
    </div>
    </TooltipProvider>
  )
}

function DirectEditPanelContent() {
  const container = usePortalContainer()
  const {
    isOpen, elementInfo,
    computedSpacing, computedBorderRadius, computedBorder, computedFlex,
    computedSizing, computedColor, computedBoxShadow, computedTypography,
    borderStyleControlPreference, pendingStyles,
    editModeActive, selectedElement, activeTool,
    comments, activeCommentId, textEditingElement,
  } = useDirectEditState()
  const {
    closePanel, selectParent, selectChild, selectElement,
    updateSpacingProperty, updateBorderRadiusProperty,
    updateBorderProperty, updateBorderProperties, updateRawCSS,
    updateFlexProperty, toggleFlexLayout,
    updateSizingProperty, updateColorProperty, updateTypographyProperty,
    resetToOriginal, exportEdits, sendEditToAgent,
    handleMoveComplete, setActiveTool,
    addComment, updateCommentText, addCommentReply, deleteComment, exportComment,
    sendCommentToAgent, setActiveCommentId,
    startTextEditing, commitTextEditing,
    canSendEditToAgent,
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
  const [commentInputAttention, setCommentInputAttention] = React.useState<{ commentId: string; nonce: number } | null>(null)

  const { isActive: measurementActive, hoveredElement, measurements, mousePosition } = useMeasurement(
    isOpen ? selectedElement : null
  )

  const {
    dragState,
    dropIndicator,
    startDrag,
  } = useMove({
    onMoveComplete: handleMoveComplete,
  })

  const triggerCommentInputAttention = React.useCallback((commentId: string) => {
    setCommentInputAttention((prev) => (
      prev?.commentId === commentId
        ? { commentId, nonce: prev.nonce + 1 }
        : { commentId, nonce: 1 }
    ))
  }, [])

  const hasPendingCommentDraft = React.useCallback((nextCommentId: string | null = null) => {
    if (!activeCommentId) return false
    if (nextCommentId && nextCommentId === activeCommentId) return false
    const active = comments.find((comment) => comment.id === activeCommentId)
    if (!active || active.text.trim().length > 0) return false
    triggerCommentInputAttention(active.id)
    return true
  }, [activeCommentId, comments, triggerCommentInputAttention])

  const handleSetActiveComment = React.useCallback((id: string | null) => {
    if (id && hasPendingCommentDraft(id)) return
    setActiveCommentId(id)
  }, [hasPendingCommentDraft, setActiveCommentId])

  const overlay = editModeActive && container ? createPortal(
    <InteractionOverlay
      activeTool={activeTool}
      selectedElement={selectedElement}
      textEditingElement={textEditingElement}
      activeCommentId={activeCommentId}
      hoverHighlight={hoverHighlight}
      onSelectElement={selectElement}
      onStartTextEditing={startTextEditing}
      onAddComment={addComment}
      onSetActiveCommentId={setActiveCommentId}
      onSetHoverHighlight={setHoverHighlight}
      hasPendingCommentDraft={hasPendingCommentDraft}
    />,
    container
  ) : null

  const commentOverlay = editModeActive && comments.length > 0 && container ? createPortal(
    <CommentOverlay
      comments={comments}
      activeCommentId={activeCommentId}
      onSetActiveComment={handleSetActiveComment}
      onUpdateText={updateCommentText}
      onAddReply={addCommentReply}
      onDelete={deleteComment}
      onExport={exportComment}
      onSendToAgent={sendCommentToAgent}
      attentionRequest={commentInputAttention}
    />,
    container
  ) : null

  if (!isOpen || !computedSpacing || !elementInfo || !computedBorderRadius || !computedBorder || !computedFlex || !computedSizing || !computedColor || computedBoxShadow === null || !computedTypography || !container) return <>{overlay}{commentOverlay}</>

  const handleMoveStart = (
    e: React.PointerEvent,
    targetElement?: HTMLElement,
    options?: { constrainToOriginalParent?: boolean }
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
    selectedElement
    && (
      (isFlexContainer(selectedElement) && selectedElement.children.length > 1)
      || hasMultiItemFlexAncestor
    )
  )

  return createPortal(
    <>
      {overlay}
      {commentOverlay}

      {selectedElement && (
        <SelectionOverlay
          selectedElement={selectedElement}
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
            if (elementUnder && elementUnder !== selectedElement && selectedElement.contains(elementUnder)) {
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
          onClickThrough={(clientX, clientY) => {
            if (!selectedElement) return
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
        />
      )}

      {dragState.isDragging && (
        <MoveOverlay dropIndicator={dropIndicator} />
      )}

      {measurementActive && selectedElement && (
        <MeasurementOverlay
          selectedElement={selectedElement}
          hoveredElement={hoveredElement}
          measurements={[
            ...measurements,
            ...calculateGuidelineMeasurements(selectedElement, getStoredGuidelines(), mousePosition),
          ]}
        />
      )}

      <DirectEditPanelInner
        elementInfo={elementInfo}
        computedSpacing={computedSpacing}
        computedBorderRadius={computedBorderRadius}
        computedBorder={computedBorder}
        computedFlex={computedFlex}
        computedSizing={computedSizing}
        computedColor={computedColor}
        computedBoxShadow={computedBoxShadow}
        borderStyleControlPreference={borderStyleControlPreference}
        computedTypography={computedTypography}
        pendingStyles={pendingStyles}
        onClose={closePanel}
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
        onUpdateTypography={updateTypographyProperty}
        onReset={resetToOriginal}
        onExportEdits={exportEdits}
        onSendToAgent={sendEditToAgent}
        canSendToAgent={canSendEditToAgent({
          selectedElement,
          elementInfo,
          pendingStyles,
        })}
        className="fixed z-[99999]"
        style={{
          left: position.x,
          top: position.y,
          maxHeight: PANEL_HEIGHT,
          pointerEvents: 'auto',
          ...(isSnapping && {
            transition: 'left 300ms cubic-bezier(0.34, 1.56, 0.64, 1), top 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
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

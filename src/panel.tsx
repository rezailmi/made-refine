import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePortalContainer } from './portal-container'
import { useDirectEditState, useDirectEditActions } from './provider'
import { Button } from './ui/button'
import {
  TooltipProvider,
} from './ui/tooltip'
import {
  Select,
  SelectTrigger,
  SelectPortal,
  SelectPositioner,
  SelectPopup,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
} from './ui/select'
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
import { MoveOverlay } from './move-overlay'
import { SelectionOverlay } from './selection-overlay'
import { CommentOverlay } from './comment-overlay'
import {
  X,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  ArrowDown,
  MoveHorizontal,
  ChevronsUpDown,
  Plus,
  Minus,
  Send,
} from 'lucide-react'

// Panel module imports
import { NumberInput, Tip, CollapsibleSection, SectionNav, useSectionNav } from './panel/shared'
import type { SectionKey } from './panel/shared'
import { SpacingInputs } from './panel/spacing-inputs'
import { BorderRadiusInputs } from './panel/border-radius-inputs'
import { BorderSection } from './panel/border-section'
import { ShadowSection } from './panel/shadow-section'
import { TypographyInputs } from './panel/typography-inputs'
import { FillSection } from './panel/fill-section'
import { SizingInputs, SizingFixedInput, DISTRIBUTE_MODES, DISTRIBUTE_LABELS, type DistributeMode } from './panel/sizing-inputs'
import { AlignmentGrid } from './panel/alignment-grid'

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

const STORAGE_KEY = 'direct-edit-panel-position'
const PANEL_WIDTH = 300
const PANEL_HEIGHT = 420

interface Position {
  x: number
  y: number
}

function getInitialPosition(): Position {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Fall through to default
  }

  return {
    x: window.innerWidth - PANEL_WIDTH - 20,
    y: window.innerHeight - PANEL_HEIGHT - 20,
  }
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
}: DirectEditPanelInnerProps) {
  const [copied, setCopied] = React.useState(false)
  const [copyError, setCopyError] = React.useState(false)
  const [sendStatus, setSendStatus] = React.useState<'idle' | 'sending' | 'sent' | 'offline'>('idle')
  const distributeMode: DistributeMode =
    computedFlex?.justifyContent === 'space-between' ||
    computedFlex?.justifyContent === 'space-around' ||
    computedFlex?.justifyContent === 'space-evenly'
      ? computedFlex.justifyContent
      : 'fixed'
  const isDistributeValue = distributeMode !== 'fixed'

  const handleCopy = async () => {
    const success = await onExportEdits()
    if (success) {
      setCopyError(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    }
    setCopied(false)
    setCopyError(true)
    setTimeout(() => setCopyError(false), 2000)
  }

  const handleSendToAgent = async () => {
    if (sendStatus === 'sending') return
    setSendStatus('sending')
    const success = await onSendToAgent()
    if (success) {
      setSendStatus('sent')
      setTimeout(() => setSendStatus('idle'), 2000)
    } else {
      setSendStatus('offline')
      setTimeout(() => setSendStatus('idle'), 2000)
    }
  }

  const hasPendingChanges = Object.keys(pendingStyles).length > 0
  const canTriggerSend = canSendToAgent || hasPendingChanges
  const isDraggable = onHeaderPointerDown !== undefined
  const panelBarBaseClass = 'flex h-11 shrink-0 items-center border-border/50 bg-background pl-3 pr-2'

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
        'flex flex-col overflow-hidden rounded-xl outline outline-1 outline-foreground/10 shadow-lg',
        isDragging && 'cursor-grabbing select-none',
        className
      )}
      style={{ width: PANEL_WIDTH, ...style }}
    >
      <div
        className={cn(
          panelBarBaseClass,
          'gap-2 border-b',
          isDraggable && 'cursor-grab active:cursor-grabbing'
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
      >
        <div className="min-w-0 flex-1">
          <code className="text-xs font-medium text-foreground">
            &lt;{elementInfo.tagName}&gt;
          </code>
          {elementInfo.id && (
            <span className="ml-1.5 text-xs text-muted-foreground">#{elementInfo.id}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onSelectParent && (
            <Tip label="Select Parent">
              <Button
                variant="ghost"
                size="icon"
                onClick={onSelectParent}
                disabled={!elementInfo.parentElement}
                className="size-7"
              >
                <ChevronUp className="size-3.5" />
              </Button>
            </Tip>
          )}
          {onSelectChild && (
            <Tip label="Select Child">
              <Button
                variant="ghost"
                size="icon"
                onClick={onSelectChild}
                disabled={!elementInfo.hasChildren}
                className="size-7"
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </Tip>
          )}
          {onClose && (
            <>
              <div className="mx-0.5 h-4 w-px bg-border" />
              <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
                <X className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <SectionNav
        scrollRef={scrollRef}
        activeSection={activeSection}
        showColors={!!computedColor}
        showText={elementInfo.isTextElement && !!computedTypography}
        sectionRefs={sectionRefs}
      />

      <div className="flex-1 overflow-y-auto backdrop-blur-xl bg-background/85" ref={scrollRef}>
        <CollapsibleSection title="Layout" actions={
          <Tip label={elementInfo.isFlexContainer ? 'Remove flex (Shift+A)' : 'Add flex (Shift+A)'}>
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={onToggleFlex}
            >
              {elementInfo.isFlexContainer ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
            </button>
          </Tip>
        }>
          <div className="space-y-3" ref={sectionRefs.layout}>
            {elementInfo.isFlexContainer && (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Flex</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <div className="flex h-7 gap-0.5 rounded-lg bg-muted p-0.5">
                      <Tip label="Row">
                        <button
                          type="button"
                          className={cn(
                            'flex flex-1 items-center justify-center rounded-md transition-all',
                            computedFlex.flexDirection === 'row'
                              ? 'bg-background text-blue-500 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => onUpdateFlex('flexDirection', 'row')}
                        >
                          <ArrowRight className="size-3.5" />
                        </button>
                      </Tip>
                      <Tip label="Column">
                        <button
                          type="button"
                          className={cn(
                            'flex flex-1 items-center justify-center rounded-md transition-all',
                            computedFlex.flexDirection === 'column'
                              ? 'bg-background text-blue-500 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => onUpdateFlex('flexDirection', 'column')}
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </Tip>
                    </div>

                    <div className="flex h-7 items-center overflow-hidden rounded-md border-0 bg-muted text-xs focus-within:outline-none focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring">
                      <span className="flex flex-1 items-center gap-1.5 px-2">
                        <MoveHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
                        {isDistributeValue ? (
                          <span className="flex-1 truncate">{DISTRIBUTE_LABELS[distributeMode]}</span>
                        ) : (
                          <SizingFixedInput
                            value={computedSpacing.gap.numericValue}
                            onValueChange={(numericValue) => {
                              const unit = computedSpacing.gap.unit === 'em' || computedSpacing.gap.unit === '' ? 'px' : computedSpacing.gap.unit
                              onUpdateSpacing('gap', {
                                numericValue,
                                unit,
                                raw: `${numericValue}${unit}`,
                              })
                            }}
                          />
                        )}
                      </span>
                      <Select value={distributeMode} onValueChange={(val) => {
                        if (val) onUpdateFlex('justifyContent', val === 'fixed' ? 'flex-start' : val)
                      }}>
                        <SelectTrigger className="flex h-full items-center justify-center border-l border-border/30 px-1.5 hover:bg-muted-foreground/10 focus-visible:outline-none">
                          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectPositioner side="bottom" sideOffset={4} alignItemWithTrigger={false} className="z-[99999]">
                            <SelectPopup className="min-w-[120px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                              {DISTRIBUTE_MODES.map((mode) => (
                                <SelectItem key={mode} value={mode} className="relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-xs outline-none hover:bg-muted data-[highlighted]:bg-muted">
                                  <SelectItemIndicator className="absolute left-1.5 flex items-center justify-center">
                                    <Check className="size-3.5" />
                                  </SelectItemIndicator>
                                  <SelectItemText>{DISTRIBUTE_LABELS[mode]}</SelectItemText>
                                </SelectItem>
                              ))}
                            </SelectPopup>
                          </SelectPositioner>
                        </SelectPortal>
                      </Select>
                    </div>
                  </div>

                  <AlignmentGrid
                    justifyContent={computedFlex.justifyContent}
                    alignItems={computedFlex.alignItems}
                    onChange={(justify, align) => {
                      onUpdateFlex('justifyContent', justify)
                      onUpdateFlex('alignItems', align)
                    }}
                  />
                </div>
              </div>
            )}

            {computedSizing && (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Sizing</div>
                <SizingInputs
                  width={computedSizing.width}
                  height={computedSizing.height}
                  onWidthChange={(value) => onUpdateSizing('width', value)}
                  onHeightChange={(value) => onUpdateSizing('height', value)}
                />
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Padding</div>
              <SpacingInputs
                prefix="padding"
                values={{
                  top: computedSpacing.paddingTop,
                  right: computedSpacing.paddingRight,
                  bottom: computedSpacing.paddingBottom,
                  left: computedSpacing.paddingLeft,
                }}
                onChange={onUpdateSpacing}
              />
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Margin</div>
              <SpacingInputs
                prefix="margin"
                values={{
                  top: computedSpacing.marginTop,
                  right: computedSpacing.marginRight,
                  bottom: computedSpacing.marginBottom,
                  left: computedSpacing.marginLeft,
                }}
                onChange={onUpdateSpacing}
              />
            </div>
          </div>
        </CollapsibleSection>

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

      <div
        className={cn(
          panelBarBaseClass,
          'gap-1 border-t',
          isDraggable && 'cursor-grab active:cursor-grabbing'
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
      >
        <div className="flex-1" />
        <Tip label="Copy edits">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="size-7"
          >
            {copyError ? (
              <X className="size-3.5 text-red-500" />
            ) : copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </Tip>
        <Tip label="Apply changes via agent">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSendToAgent}
            disabled={!canTriggerSend || sendStatus === 'sending'}
            className="size-7"
          >
            {sendStatus === 'offline' ? (
              <X className="size-3.5 text-red-500" />
            ) : sendStatus === 'sent' ? (
              <Check className="size-3.5 text-green-500" />
            ) : sendStatus === 'sending' ? (
              <Send className="size-3.5 animate-pulse" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </Tip>
      </div>
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

  const [position, setPosition] = React.useState<Position>(getInitialPosition)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragOffset, setDragOffset] = React.useState<Position>({ x: 0, y: 0 })
  const [hoverHighlight, setHoverHighlight] = React.useState<{
    flexContainer: HTMLElement
    children: HTMLElement[]
  } | null>(null)
  const [commentInputAttention, setCommentInputAttention] = React.useState<{ commentId: string; nonce: number } | null>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!panelRef.current) return

    const rect = panelRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return

    const newX = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, e.clientX - dragOffset.x))
    const newY = Math.max(0, Math.min(window.innerHeight - PANEL_HEIGHT, e.clientY - dragOffset.y))

    setPosition({ x: newX, y: newY })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return

    setIsDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(position)) } catch {}
  }

  React.useEffect(() => {
    function handleResize() {
      setPosition((prev) => ({
        x: Math.min(prev.x, window.innerWidth - PANEL_WIDTH - 20),
        y: Math.min(prev.y, window.innerHeight - PANEL_HEIGHT - 20),
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    <>
      <div
        role="presentation"
        data-direct-edit="overlay"
        className={cn('fixed inset-0 z-[99990] cursor-default')}
        style={{ pointerEvents: textEditingElement ? 'none' : 'auto' }}
        onDoubleClick={(e) => {
          e.preventDefault()
          if (activeTool !== 'select') return
          const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
          if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
            const resolved = resolveElementTarget(elementUnder, selectedElement)
            if (isTextElement(resolved)) {
              if (selectedElement !== resolved) selectElement(resolved)
              startTextEditing(resolved)
            }
          }
        }}
        onMouseMove={(e) => {
          const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
          setHoverHighlight(computeHoverHighlight(elementUnder, selectedElement))
        }}
        onMouseLeave={() => setHoverHighlight(null)}
        onClick={(e) => {
          e.preventDefault()
          setHoverHighlight(null)
          if (activeTool === 'comment') {
            if (hasPendingCommentDraft()) return
            const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
            if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
              const resolved = resolveElementTarget(elementUnder, selectedElement)
              addComment(resolved, { x: e.clientX, y: e.clientY })
            }
            return
          }
          if (activeCommentId) { setActiveCommentId(null); return }
          const elementUnder = elementFromPointWithoutOverlays(e.clientX, e.clientY)
          if (elementUnder && elementUnder !== document.body && elementUnder !== document.documentElement) {
            const resolved = resolveElementTarget(elementUnder, selectedElement)
            selectElement(resolved)
          }
        }}
      />
      {hoverHighlight && (() => {
        const cr = hoverHighlight.flexContainer.getBoundingClientRect()
        return (
          <svg
            data-direct-edit="hover-highlight"
            className="pointer-events-none fixed inset-0 z-[99991]"
            width="100%"
            height="100%"
            style={{ width: '100vw', height: '100vh' }}
          >
            <rect
              x={cr.left}
              y={cr.top}
              width={cr.width}
              height={cr.height}
              fill="transparent"
              stroke="#3b82f6"
              strokeWidth={1}
            />
            {hoverHighlight.children.map((child, i) => {
              const r = child.getBoundingClientRect()
              return (
                <rect
                  key={`${r.left}-${r.top}-${r.width}-${r.height}`}
                  x={r.left}
                  y={r.top}
                  width={r.width}
                  height={r.height}
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
              )
            })}
          </svg>
        )
      })()}
    </>,
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
        canSendToAgent={canSendEditToAgent()}
        className="fixed z-[99999]"
        style={{
          left: position.x,
          top: position.y,
          maxHeight: PANEL_HEIGHT,
          pointerEvents: 'auto',
        }}
        panelRef={panelRef}
        isDragging={isDragging}
        onHeaderPointerDown={handlePointerDown}
        onHeaderPointerMove={handlePointerMove}
        onHeaderPointerUp={handlePointerUp}
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

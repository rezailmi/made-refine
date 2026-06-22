import * as React from 'react'
import { Tip, CollapsibleSection } from './shared'
import { cn } from '../cn'
import {
  Select,
  SelectTrigger,
  SelectPortal,
  SelectPositioner,
  SelectPopup,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
} from '../ui/select'
import { SpacingInputs } from './spacing-inputs'
import {
  SizingInputs,
  SizingFixedInput,
  DISTRIBUTE_MODES,
  DISTRIBUTE_LABELS,
  type DistributeMode,
} from './sizing-inputs'
import { AlignmentGrid } from './alignment-grid'
import type {
  CSSPropertyValue,
  SpacingPropertyKey,
  SizingValue,
  SizingPropertyKey,
  EffectsProperties,
} from '../types'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import {
  Check,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  MoveHorizontal,
  ChevronsUpDown,
  Plus,
  Minus,
  WrapText,
} from 'lucide-react'

export interface LayoutSectionProps {
  elementInfo: {
    isFlexContainer: boolean
    hasChildren: boolean
  }
  computedFlex: {
    flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
    justifyContent: string
    alignItems: string
    flexWrap: 'nowrap' | 'wrap' | 'wrap-reverse'
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
  computedSizing: {
    width: SizingValue
    height: SizingValue
  } | null
  onToggleFlex?: () => void
  onUpdateFlex: (
    key: 'flexDirection' | 'justifyContent' | 'alignItems' | 'flexWrap',
    value: string
  ) => void
  onUpdateSpacing: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
  onUpdateSizing: (key: SizingPropertyKey, value: SizingValue) => void
  overflow?: EffectsProperties['overflow']
  onUpdateOverflow?: (value: EffectsProperties['overflow']) => void
  sectionRef: React.Ref<HTMLDivElement>
}

export function LayoutSection({
  elementInfo,
  computedFlex,
  computedSpacing,
  computedSizing,
  onToggleFlex,
  onUpdateFlex,
  onUpdateSpacing,
  onUpdateSizing,
  overflow,
  onUpdateOverflow,
  sectionRef,
}: LayoutSectionProps) {
  const distributeMode: DistributeMode =
    computedFlex?.justifyContent === 'space-between' ||
    computedFlex?.justifyContent === 'space-around' ||
    computedFlex?.justifyContent === 'space-evenly'
      ? computedFlex.justifyContent
      : 'fixed'
  const isDistributeValue = distributeMode !== 'fixed'

  return (
    <CollapsibleSection
      title="Layout"
      actions={
        onToggleFlex && (
          <Tip label={elementInfo.isFlexContainer ? 'Remove flex (Shift+A)' : 'Add flex (Shift+A)'}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={onToggleFlex}
            >
              {elementInfo.isFlexContainer ? <Minus /> : <Plus />}
            </Button>
          </Tip>
        )
      }
    >
      <div className="space-y-2" ref={sectionRef}>
        {!elementInfo.isFlexContainer && onToggleFlex && (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Flex</div>
            <button
              type="button"
              className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-muted text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={onToggleFlex}
            >
              <Plus className="size-3.5" />
              Add flex layout
            </button>
          </div>
        )}

        {elementInfo.isFlexContainer &&
          (() => {
            const isRowActive =
              computedFlex.flexDirection === 'row' || computedFlex.flexDirection === 'row-reverse'
            const isColActive =
              computedFlex.flexDirection === 'column' ||
              computedFlex.flexDirection === 'column-reverse'
            const isRowReversed = computedFlex.flexDirection === 'row-reverse'
            const isColReversed = computedFlex.flexDirection === 'column-reverse'
            const isWrapActive =
              computedFlex.flexWrap === 'wrap' || computedFlex.flexWrap === 'wrap-reverse'

            return (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Flex</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <div className="flex h-7 gap-0.5 rounded-md bg-muted p-0.5">
                      <Tip label={isRowReversed ? 'Row (reversed)' : 'Row'}>
                        <button
                          type="button"
                          aria-label={isRowReversed ? 'Row (reversed)' : 'Row'}
                          className={cn(
                            'flex flex-1 items-center justify-center rounded-md transition-all',
                            isRowActive
                              ? 'bg-background text-blue-500 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => {
                            if (isRowActive) {
                              onUpdateFlex('flexDirection', isRowReversed ? 'row' : 'row-reverse')
                            } else {
                              onUpdateFlex('flexDirection', 'row')
                            }
                          }}
                        >
                          {isRowReversed ? (
                            <ArrowLeft className="size-3.5" />
                          ) : (
                            <ArrowRight className="size-3.5" />
                          )}
                        </button>
                      </Tip>
                      <Tip label={isColReversed ? 'Column (reversed)' : 'Column'}>
                        <button
                          type="button"
                          aria-label={isColReversed ? 'Column (reversed)' : 'Column'}
                          className={cn(
                            'flex flex-1 items-center justify-center rounded-md transition-all',
                            isColActive
                              ? 'bg-background text-blue-500 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => {
                            if (isColActive) {
                              onUpdateFlex(
                                'flexDirection',
                                isColReversed ? 'column' : 'column-reverse'
                              )
                            } else {
                              onUpdateFlex('flexDirection', 'column')
                            }
                          }}
                        >
                          {isColReversed ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )}
                        </button>
                      </Tip>
                      <Tip label="Wrap">
                        <button
                          type="button"
                          aria-label="Wrap"
                          className={cn(
                            'flex flex-1 items-center justify-center rounded-md transition-all',
                            isWrapActive
                              ? 'bg-background text-blue-500 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => onUpdateFlex('flexWrap', isWrapActive ? 'nowrap' : 'wrap')}
                        >
                          <WrapText className="size-3.5" />
                        </button>
                      </Tip>
                    </div>

                    <div className="flex h-7 items-center overflow-hidden rounded-md border-0 bg-muted text-xs focus-within:outline-none focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring">
                      <span className="flex flex-1 items-center gap-1.5 px-2">
                        <MoveHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
                        {isDistributeValue ? (
                          <span className="flex-1 truncate">
                            {DISTRIBUTE_LABELS[distributeMode]}
                          </span>
                        ) : (
                          <SizingFixedInput
                            value={computedSpacing.gap.numericValue}
                            onValueChange={(numericValue) => {
                              const unit =
                                computedSpacing.gap.unit === 'em' || computedSpacing.gap.unit === ''
                                  ? 'px'
                                  : computedSpacing.gap.unit
                              onUpdateSpacing('gap', {
                                numericValue,
                                unit,
                                raw: `${numericValue}${unit}`,
                              })
                            }}
                          />
                        )}
                      </span>
                      <Select
                        value={distributeMode}
                        onValueChange={(val) => {
                          if (val)
                            onUpdateFlex('justifyContent', val === 'fixed' ? 'flex-start' : val)
                        }}
                      >
                        <SelectTrigger className="flex h-full items-center justify-center border-l border-border/30 px-1.5 hover:bg-muted-foreground/10 focus-visible:outline-none">
                          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectPositioner
                            side="bottom"
                            sideOffset={4}
                            alignItemWithTrigger={false}
                            className="z-[99999]"
                          >
                            <SelectPopup className="min-w-[120px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                              {DISTRIBUTE_MODES.map((mode) => (
                                <SelectItem
                                  key={mode}
                                  value={mode}
                                  className="relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-xs outline-none hover:bg-muted data-[highlighted]:bg-muted"
                                >
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
            )
          })()}

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

        {onUpdateOverflow && elementInfo.hasChildren && (
          <label className="flex cursor-default items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={overflow != null && overflow !== 'visible'}
              onCheckedChange={(checked) => onUpdateOverflow(checked ? 'hidden' : 'visible')}
            />
            Clip content
          </label>
        )}
      </div>
    </CollapsibleSection>
  )
}

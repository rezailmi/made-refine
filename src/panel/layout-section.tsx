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
import { SizingInputs, SizingFixedInput, DISTRIBUTE_MODES, DISTRIBUTE_LABELS, type DistributeMode } from './sizing-inputs'
import { AlignmentGrid } from './alignment-grid'
import type { CSSPropertyValue, SpacingPropertyKey, SizingValue, SizingPropertyKey } from '../types'
import { Button } from '../ui/button'
import {
  Check,
  ArrowRight,
  ArrowDown,
  MoveHorizontal,
  ChevronsUpDown,
  Plus,
  Minus,
} from 'lucide-react'

export interface LayoutSectionProps {
  elementInfo: {
    isFlexContainer: boolean
  }
  computedFlex: {
    flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
    justifyContent: string
    alignItems: string
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
  onToggleFlex: () => void
  onUpdateFlex: (key: 'flexDirection' | 'justifyContent' | 'alignItems', value: string) => void
  onUpdateSpacing: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
  onUpdateSizing: (key: SizingPropertyKey, value: SizingValue) => void
  sectionRef: React.RefObject<HTMLDivElement>
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
    <CollapsibleSection title="Layout" actions={
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
    }>
      <div className="space-y-2" ref={sectionRef}>
        {elementInfo.isFlexContainer && (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Flex</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <div className="flex h-7 gap-0.5 rounded-md bg-muted p-0.5">
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
  )
}

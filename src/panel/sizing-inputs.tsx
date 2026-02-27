import * as React from 'react'
import { Button } from '../ui/button'
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
import type { SizingValue, SizingMode, SizingPropertyKey } from '../types'
import { useDirectEditState } from '../provider'
import { Tip, selectOnFocus } from './shared'
import {
  Check,
  ChevronsUpDown,
  Link,
  Unlink,
} from 'lucide-react'

export const SIZING_OPTIONS: { value: SizingMode; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'fill', label: 'Fill container' },
  { value: 'fit', label: 'Fit content' },
]

export const DISTRIBUTE_MODES = ['fixed', 'space-between', 'space-around', 'space-evenly'] as const
export type DistributeMode = typeof DISTRIBUTE_MODES[number]
export const DISTRIBUTE_LABELS: Record<DistributeMode, string> = {
  fixed: 'Fixed',
  'space-between': 'Between',
  'space-around': 'Around',
  'space-evenly': 'Evenly',
}

export function SizingFixedInput({ value, onValueChange }: { value: number; onValueChange: (v: number) => void }) {
  const [localValue, setLocalValue] = React.useState(String(value))

  React.useEffect(() => {
    setLocalValue(String(value))
  }, [value])

  return (
    <input
      type="number"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value)
        const parsed = parseFloat(e.target.value)
        if (!isNaN(parsed)) onValueChange(parsed)
      }}
      onBlur={() => {
        if (localValue === '' || isNaN(parseFloat(localValue))) {
          setLocalValue(String(value))
        }
      }}
      onFocus={selectOnFocus}
      className="w-full min-w-0 flex-1 bg-transparent text-xs tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
    />
  )
}

interface SizingDropdownProps {
  label: string
  value: SizingValue
  onChange: (value: SizingValue) => void
}

export function SizingDropdown({ label, value, onChange }: SizingDropdownProps) {
  const handleFixedValueChange = (numericValue: number) => {
    onChange({
      mode: 'fixed',
      value: {
        numericValue,
        unit: 'px',
        raw: `${numericValue}px`,
      },
    })
  }

  return (
    <div className="flex h-7 flex-1 items-center overflow-hidden rounded-md border-0 bg-muted text-xs focus-within:outline-none focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring">
      <span className="flex flex-1 items-center gap-1.5 px-2">
        <span className="text-muted-foreground">{label}</span>
        {value.mode === 'fixed' ? (
          <SizingFixedInput
            value={Math.round(value.value.numericValue)}
            onValueChange={handleFixedValueChange}
          />
        ) : (
          <span className="flex flex-1 items-center gap-1">
            <span className="tabular-nums text-muted-foreground">{Math.round(value.value.numericValue)}</span>
            <span>{value.mode === 'fill' ? 'Fill' : 'Fit'}</span>
          </span>
        )}
      </span>
      <Select value={value.mode} onValueChange={(val) => {
        if (val) onChange({ mode: val as SizingMode, value: value.value })
      }}>
        <SelectTrigger className="flex h-full items-center justify-center border-l border-border/30 px-1.5 hover:bg-muted-foreground/10 focus-visible:outline-none">
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner side="bottom" sideOffset={4} alignItemWithTrigger={false} className="z-[99999]">
            <SelectPopup className="min-w-[100px] overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
              {SIZING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-xs outline-none hover:bg-muted data-[highlighted]:bg-muted">
                  <SelectItemIndicator className="absolute left-1.5 flex items-center justify-center">
                    <Check className="size-3.5" />
                  </SelectItemIndicator>
                  <SelectItemText>{option.label}</SelectItemText>
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select>
    </div>
  )
}

interface SizingInputsProps {
  width: SizingValue
  height: SizingValue
  onWidthChange: (value: SizingValue) => void
  onHeightChange: (value: SizingValue) => void
}

export function SizingInputs({ width, height, onWidthChange, onHeightChange }: SizingInputsProps) {
  const { selectedElement } = useDirectEditState()
  const [locked, setLocked] = React.useState(false)
  const ratioRef = React.useRef<number>(1)

  React.useEffect(() => {
    setLocked(false)
  }, [selectedElement])

  const canLock = width.mode === 'fixed' && height.mode === 'fixed' && height.value.numericValue > 0 && width.value.numericValue > 0

  const handleLockToggle = () => {
    if (!locked && canLock) {
      ratioRef.current = width.value.numericValue / height.value.numericValue
    }
    setLocked(!locked)
  }

  const handleWidthChange = (value: SizingValue) => {
    onWidthChange(value)
    if (locked && value.mode === 'fixed' && height.mode === 'fixed' && ratioRef.current > 0) {
      const newHeight = Math.round(value.value.numericValue / ratioRef.current)
      onHeightChange({
        mode: 'fixed',
        value: { numericValue: newHeight, unit: height.value.unit, raw: `${newHeight}${height.value.unit}` },
      })
    }
  }

  const handleHeightChange = (value: SizingValue) => {
    onHeightChange(value)
    if (locked && value.mode === 'fixed' && width.mode === 'fixed' && ratioRef.current > 0) {
      const newWidth = Math.round(value.value.numericValue * ratioRef.current)
      onWidthChange({
        mode: 'fixed',
        value: { numericValue: newWidth, unit: width.value.unit, raw: `${newWidth}${width.value.unit}` },
      })
    }
  }

  return (
    <div className="flex items-center gap-2">
      <SizingDropdown label="W" value={width} onChange={handleWidthChange} />
      <SizingDropdown label="H" value={height} onChange={handleHeightChange} />
      <Tip label={locked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}>
        <Button
          variant={locked ? 'secondary' : 'ghost'}
          size="icon"
          className="size-7 shrink-0"
          onClick={handleLockToggle}
          disabled={!canLock}
        >
          {locked ? <Link /> : <Unlink />}
        </Button>
      </Tip>
    </div>
  )
}

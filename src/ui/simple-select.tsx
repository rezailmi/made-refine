import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  Select,
  SelectTrigger,
  SelectIcon,
  SelectPortal,
  SelectPositioner,
  SelectPopup,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
} from './select'
import { cn } from '../cn'

interface SimpleSelectOption {
  value: string
  label: string
}

interface SimpleSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SimpleSelectOption[]
  popupMinWidth?: string
  triggerClassName?: string
  itemClassName?: string
  children?: React.ReactNode
  icon?: React.ReactNode
  label?: string
}

function SimpleSelect({
  value,
  onValueChange,
  options,
  popupMinWidth = '100px',
  triggerClassName,
  itemClassName,
  children,
  icon,
  label,
}: SimpleSelectProps) {
  const defaultItemClass = 'relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-xs outline-none hover:bg-muted data-[highlighted]:bg-muted'

  return (
    <Select value={value} onValueChange={(val) => val && onValueChange(val)}>
      {children ?? (
        <SelectTrigger className={cn(
          'flex h-7 items-center justify-between rounded-md border-0 bg-muted px-2 text-xs hover:bg-muted-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          triggerClassName,
        )}>
          <span className="flex items-center gap-2">
            {icon}
            <span>{label ?? options.find((o) => o.value === value)?.label ?? value}</span>
          </span>
          <SelectIcon>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </SelectIcon>
        </SelectTrigger>
      )}
      <SelectPortal>
        <SelectPositioner sideOffset={4} className="z-[99999]">
          <SelectPopup className={cn(
            'overflow-hidden rounded-xl outline outline-1 outline-foreground/10 bg-background p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95',
          )} style={{ minWidth: popupMinWidth }}>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className={itemClassName ?? defaultItemClass}
              >
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
  )
}

export { SimpleSelect }
export type { SimpleSelectOption, SimpleSelectProps }

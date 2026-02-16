import * as React from 'react'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  createTooltipHandle,
} from '../ui/tooltip'
import { cn } from '../cn'

interface AlignmentGridProps {
  justifyContent: string
  alignItems: string
  onChange: (justify: string, align: string) => void
}

export function AlignmentGrid({ justifyContent, alignItems, onChange }: AlignmentGridProps) {
  const justifyValues = ['flex-start', 'center', 'flex-end']
  const alignValues = ['flex-start', 'center', 'flex-end']

  const normalizeJustify = (val: string) => {
    if (val === 'start') return 'flex-start'
    if (val === 'end') return 'flex-end'
    return val
  }

  const normalizeAlign = (val: string) => {
    if (val === 'start') return 'flex-start'
    if (val === 'end') return 'flex-end'
    return val
  }

  const currentJustify = normalizeJustify(justifyContent)
  const currentAlign = normalizeAlign(alignItems)

  const tooltipHandle = createTooltipHandle<{ justify: string; align: string }>()

  return (
    <TooltipProvider delayDuration={300} closeDelay={150}>
      <div className="grid grid-cols-3 gap-0.5 rounded-md bg-muted p-0.5">
        {alignValues.map((align) =>
          justifyValues.map((justify) => {
            const isActive = currentJustify === justify && currentAlign === align
            return (
              <TooltipTrigger
                key={`${justify}-${align}`}
                handle={tooltipHandle}
                payload={{ justify, align }}
                render={
                  <button
                    type="button"
                    className={cn(
                      'flex h-7 items-center justify-center rounded transition-all',
                      isActive
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-muted-foreground/10'
                    )}
                    onClick={() => onChange(justify, align)}
                  >
                    {isActive ? (
                      <div
                        className="flex size-full gap-[2px] p-1"
                        style={{ justifyContent: justify, alignItems: align }}
                      >
                        <span className="h-2 w-[1.5px] rounded-full bg-blue-500" />
                        <span className="h-2 w-[1.5px] rounded-full bg-blue-500" />
                        <span className="h-2 w-[1.5px] rounded-full bg-blue-500" />
                      </div>
                    ) : (
                      <span className="size-1 rounded-full bg-muted-foreground/30" />
                    )}
                  </button>
                }
              />
            )
          })
        )}
      </div>
      <Tooltip handle={tooltipHandle}>
        {({ payload }) => (
          <TooltipContent side="bottom" sideOffset={8} className="flex flex-col">
            justify: {payload?.justify}, align: {payload?.align}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

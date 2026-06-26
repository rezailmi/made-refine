import * as React from 'react'
import { Popover } from '@base-ui/react/popover'
import { ChevronDown } from 'lucide-react'
import { usePortalContainer } from '../portal-container'
import { useOutsideClickDismiss } from '../hooks/use-outside-click-dismiss'
import { cn } from '../cn'

function TokenChipPortal(props: React.ComponentPropsWithoutRef<typeof Popover.Portal>) {
  const container = usePortalContainer()
  return <Popover.Portal container={container} {...props} />
}

export interface TokenChipProps {
  /** Text shown in the pill, e.g. '--color-primary' or 'text-base'. */
  label: string
  /** Optional swatch hex (6 chars, no #). Render a swatch when present. */
  swatchHex?: string
  /** Popover body — chain, resolved value, editable inputs, etc. */
  children?: React.ReactNode
  className?: string
}

export function TokenChip({ label, swatchHex, children, className }: TokenChipProps) {
  const [open, setOpen] = React.useState(false)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  useOutsideClickDismiss(open, () => setOpen(false), [popupRef, triggerRef])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        ref={triggerRef}
        render={<button type="button" />}
        className={cn(
          'flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border-0 bg-muted px-2 text-xs text-foreground hover:bg-muted-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          className,
        )}
      >
        {swatchHex && (
          <span
            className="size-3.5 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
            style={{ backgroundColor: `#${swatchHex}` }}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-left font-mono">{label}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      {children != null && (
        <TokenChipPortal>
          <Popover.Positioner side="bottom" align="start" sideOffset={4} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
            <Popover.Popup
              ref={popupRef}
              className="w-[240px] rounded-xl bg-background p-3 text-xs shadow-lg outline outline-1 outline-foreground/10"
            >
              {children}
            </Popover.Popup>
          </Popover.Positioner>
        </TokenChipPortal>
      )}
    </Popover.Root>
  )
}

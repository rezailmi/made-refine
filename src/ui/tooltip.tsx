import * as React from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { usePortalContainer } from '../portal-container'
import { cn } from '../cn'

const TooltipProvider = ({
  children,
  delay,
  delayDuration = 300,
  closeDelay = 0,
  ...props
}: {
  children: React.ReactNode
  delay?: number
  delayDuration?: number
  closeDelay?: number
}) => (
  <TooltipPrimitive.Provider delay={delay ?? delayDuration} closeDelay={closeDelay} {...props}>
    {children}
  </TooltipPrimitive.Provider>
)

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Popup>,
  Omit<React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Popup>, 'side' | 'align'> & {
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    sideOffset?: number
  }
>(({ className, side, align, sideOffset = 8, ...props }, ref) => {
  const container = usePortalContainer()
  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} className="fixed z-[99999]">
        <TooltipPrimitive.Popup
          ref={ref}
          className={cn(
            'overflow-hidden rounded-md bg-[#171717] px-3 py-1.5 text-xs text-[#fafafa] animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            className
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
})
TooltipContent.displayName = 'TooltipContent'

const createTooltipHandle = TooltipPrimitive.createHandle

function TooltipPortal(props: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Portal>) {
  const container = usePortalContainer()
  return <TooltipPrimitive.Portal container={container} {...props} />
}

const TooltipPositioner = TooltipPrimitive.Positioner
const TooltipPopup = TooltipPrimitive.Popup

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  createTooltipHandle,
  TooltipPortal,
  TooltipPositioner,
  TooltipPopup,
}

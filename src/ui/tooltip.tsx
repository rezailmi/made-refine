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
            'rounded-md bg-[canvas] px-2 py-1 text-xs origin-(--transform-origin) shadow-lg shadow-gray-200 outline-1 outline-gray-200 transition-[transform,scale,opacity] data-starting-style:scale-90 data-starting-style:opacity-0 data-ending-style:scale-90 data-ending-style:opacity-0 data-instant:transition-none dark:shadow-none dark:outline-gray-300 dark:-outline-offset-1',
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

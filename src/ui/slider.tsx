import * as React from 'react'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { cn } from '../cn'

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative w-full', className)}
    {...props}
  >
    <SliderPrimitive.Control className="flex w-full touch-none select-none items-center px-1 py-3">
      <SliderPrimitive.Track className="h-2 w-full rounded-full bg-muted">
        <SliderPrimitive.Indicator className="h-full rounded-full bg-foreground" />
        <SliderPrimitive.Thumb className="h-3.5 w-2 rounded-sm border-2 border-white bg-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.3)] transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Track>
    </SliderPrimitive.Control>
  </SliderPrimitive.Root>
))
Slider.displayName = 'Slider'

export { Slider }

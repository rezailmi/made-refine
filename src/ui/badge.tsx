import * as React from 'react'
import { cn } from '../cn'

const badgeVariants = {
  base: 'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
  variant: {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-muted text-secondary-foreground',
    outline: 'border-border bg-transparent text-foreground',
  },
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof badgeVariants.variant
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        badgeVariants.base,
        badgeVariants.variant[variant],
        className
      )}
      {...props}
    />
  )
)

Badge.displayName = 'Badge'

export { Badge }

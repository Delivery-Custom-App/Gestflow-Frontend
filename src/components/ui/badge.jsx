import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
        secondary:   'border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
        destructive: 'border-transparent bg-[hsl(var(--destructive)/0.12)] text-[hsl(354,70%,36%)] dark:text-[hsl(354,75%,72%)]',
        outline:     'text-[hsl(var(--foreground))]',
        success:     'border-transparent bg-[hsl(var(--success)/0.14)] text-[hsl(149,60%,28%)] dark:text-[hsl(149,50%,68%)]',
        warning:     'border-transparent bg-[hsl(var(--warning)/0.16)] text-[hsl(var(--warning-foreground))] dark:text-[hsl(38,90%,70%)]',
        info:        'border-transparent bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]',
        ghost:       'border-transparent bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

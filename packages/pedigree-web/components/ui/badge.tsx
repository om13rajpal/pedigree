/** Badge component for labels, statuses, and tags. */

import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white dark:bg-accent-dark',
        secondary: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50',
        success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        outline:
          'border border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

/**
 * Props for the Badge component.
 */
interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * A small label for statuses, risk classes, or category tags.
 *
 * @param variant - Visual style: default, secondary, success, warning, error, or outline.
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
export type { BadgeProps }

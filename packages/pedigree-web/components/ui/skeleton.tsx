/** Skeleton loading placeholder for content that has not yet arrived. */

import { cn } from '@/lib/utils'

/**
 * A pulsing placeholder block indicating loading content.
 *
 * Apply width and height via className to match the shape of the
 * content being loaded. The pulse animation runs via Tailwind's
 * built-in animate-pulse utility.
 *
 * @param className - Additional classes for sizing and shape.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-neutral-200/60 dark:bg-neutral-700/60', className)}
      {...props}
    />
  )
}

export { Skeleton }

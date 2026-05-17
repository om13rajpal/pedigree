/** Button primitive with size and variant support via class-variance-authority. */

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-accent text-white hover:bg-accent-hover dark:bg-accent-dark dark:hover:bg-accent',
        destructive: 'bg-error text-white hover:bg-error/90',
        outline:
          'border border-neutral-200 bg-white hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
        secondary:
          'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700',
        ghost:
          'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
        link: 'text-accent underline-offset-4 hover:underline dark:text-accent-dark',
      },
      size: {
        default: 'h-10 px-4 py-2 rounded-md',
        sm: 'h-9 px-3 rounded-sm',
        lg: 'h-11 px-8 rounded-md',
        icon: 'h-10 w-10 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

/**
 * Props for the Button component.
 */
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, renders the child element as the root instead of a button.
   * Useful for wrapping links that should look like buttons.
   */
  asChild?: boolean
}

/**
 * A styled button with variant and size support.
 *
 * Uses Radix UI Slot for polymorphic rendering when asChild is true.
 * All variants include accessible focus rings matching the design system.
 *
 * @param variant - Visual style: default, destructive, outline, secondary, ghost, or link.
 * @param size - Size preset: default, sm, lg, or icon.
 * @param asChild - Render the child element as the root node.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
export type { ButtonProps }

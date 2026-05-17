/** Shimmer button with an animated gradient sweep for primary CTAs. */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Props for the ShimmerButton component.
 */
interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Content rendered inside the button. */
  children: React.ReactNode
}

/** Keyframes injected once for the shimmer sweep animation. */
const SHIMMER_KEYFRAMES = `
@keyframes pedigree-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`

/**
 * A teal-accented button with a translating shimmer highlight.
 *
 * The shimmer is a pseudo-element gradient that sweeps across the button
 * surface on a 3s cycle using injected CSS keyframes. Respects reduced
 * motion by pausing the animation via the prefers-reduced-motion media
 * query applied in the style tag.
 *
 * @param children - Button label or content.
 */
const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: SHIMMER_KEYFRAMES }} />
        <button
          ref={ref}
          className={cn(
            'group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-md bg-accent px-8 font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:bg-accent-dark dark:hover:bg-accent',
            className,
          )}
          {...props}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent motion-reduce:hidden"
            style={{
              animation: 'pedigree-shimmer 3s infinite',
              animationPlayState: 'running',
            }}
          />
          <span className="relative z-10">{children}</span>
        </button>
      </>
    )
  },
)
ShimmerButton.displayName = 'ShimmerButton'

export { ShimmerButton }
export type { ShimmerButtonProps }

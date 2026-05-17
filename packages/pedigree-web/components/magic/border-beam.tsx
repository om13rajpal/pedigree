/** Border beam effect that creates a moving highlight around a card edge. */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Props for the BorderBeam component.
 */
interface BorderBeamProps {
  /** Additional CSS classes for the wrapper. */
  className?: string
  /** Duration of one full rotation in seconds. Defaults to 4. */
  duration?: number
}

/** Keyframes injected once for the border beam rotation. */
const BORDER_BEAM_KEYFRAMES = `
@keyframes pedigree-border-beam {
  0% { --border-beam-angle: 0deg; }
  100% { --border-beam-angle: 360deg; }
}
@property --border-beam-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
`

/**
 * A rotating conic-gradient highlight rendered as a pseudo-border.
 *
 * Place this component inside a relatively-positioned container.
 * The beam rotates around the card perimeter using CSS @property
 * animation on a conic-gradient. Falls back to a static subtle
 * border in browsers without @property support or when the user
 * prefers reduced motion.
 *
 * @param duration - Rotation cycle duration in seconds.
 */
function BorderBeam({ className, duration = 4 }: BorderBeamProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BORDER_BEAM_KEYFRAMES }} />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 rounded-[inherit] p-px motion-reduce:hidden',
          className,
        )}
        style={{
          background:
            'conic-gradient(from var(--border-beam-angle, 0deg), transparent 0deg 340deg, #0F766E 360deg)',
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          animation: `pedigree-border-beam ${duration}s linear infinite`,
        }}
      />
    </>
  )
}

export { BorderBeam }
export type { BorderBeamProps }

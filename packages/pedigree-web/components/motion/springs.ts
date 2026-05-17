/** Spring physics presets following the Emil Kowalski animation school. */

/**
 * Default spring for most UI transitions.
 *
 * Balanced stiffness and damping for a responsive feel without overshoot.
 */
export const DEFAULT_SPRING = {
  type: 'spring' as const,
  stiffness: 250,
  damping: 25,
}

/**
 * Gentle spring for subtle, low-emphasis transitions.
 *
 * Lower stiffness produces a slower, softer arrival suitable for
 * background elements or secondary content.
 */
export const GENTLE_SPRING = {
  type: 'spring' as const,
  stiffness: 150,
  damping: 20,
}

/**
 * Bouncy spring for high-emphasis, playful transitions.
 *
 * Higher stiffness with moderate damping creates a snappy feel
 * with slight overshoot. Use sparingly for hero moments.
 */
export const BOUNCY_SPRING = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
}

/**
 * Reduced motion fallback: a 100ms fade with no spring physics.
 *
 * Applied when the user has enabled prefers-reduced-motion to
 * collapse all motion into a brief opacity transition.
 */
export const REDUCED_MOTION = {
  duration: 0.1,
}

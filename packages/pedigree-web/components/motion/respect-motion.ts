/** Utility hook for respecting the user's reduced-motion preference. */

'use client'

import { useReducedMotion } from 'framer-motion'
import { DEFAULT_SPRING, REDUCED_MOTION } from './springs'

/**
 * Transition configuration returned by the useRespectMotion hook.
 */
interface MotionConfig {
  /** The transition to apply (spring or reduced fallback). */
  transition: typeof DEFAULT_SPRING | typeof REDUCED_MOTION
  /** Whether reduced motion is active. */
  isReduced: boolean
}

/**
 * Returns animation configuration that respects the user's motion preference.
 *
 * When the user has enabled prefers-reduced-motion, all spring physics
 * collapse into a 100ms opacity fade. Components should use the returned
 * transition instead of hard-coding spring values.
 *
 * @param spring - A custom spring config to use when motion is allowed.
 *   Defaults to DEFAULT_SPRING.
 * @returns A MotionConfig with the appropriate transition and a boolean flag.
 */
export function useRespectMotion(spring: typeof DEFAULT_SPRING = DEFAULT_SPRING): MotionConfig {
  const isReduced = useReducedMotion() ?? false

  return {
    transition: isReduced ? REDUCED_MOTION : spring,
    isReduced,
  }
}

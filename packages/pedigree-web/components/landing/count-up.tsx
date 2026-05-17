/** Animated number counter that counts from 0 to a target value on scroll. */

'use client'

import * as React from 'react'

/**
 * Props for the CountUp component.
 */
interface CountUpProps {
  /** The target number to count up to. */
  target: number
  /** Text displayed before the number (e.g. currency symbols). */
  prefix?: string
  /** Text displayed after the number (e.g. "%" or "s"). */
  suffix?: string
  /** Animation duration in milliseconds. Defaults to 1500. */
  duration?: number
  /** Number of decimal places to display. Defaults to 0. */
  decimals?: number
  /** Additional CSS classes for the wrapper span. */
  className?: string
}

/**
 * Counts from 0 to a target number using requestAnimationFrame.
 *
 * The animation triggers when the element enters the viewport via
 * IntersectionObserver. Uses an ease-out curve for a decelerating
 * count effect. Respects prefers-reduced-motion by showing the
 * final value immediately without animation.
 *
 * @param target - The final number value.
 * @param prefix - Optional prefix string (e.g. "EUR").
 * @param suffix - Optional suffix string (e.g. "%").
 * @param duration - Animation duration in ms.
 * @param decimals - Decimal precision.
 */
function CountUp({
  target,
  prefix = '',
  suffix = '',
  duration = 1500,
  decimals = 0,
  className,
}: CountUpProps) {
  const [displayValue, setDisplayValue] = React.useState('0')
  const elementRef = React.useRef<HTMLSpanElement>(null)
  const hasAnimated = React.useRef(false)

  React.useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setDisplayValue(target.toFixed(decimals))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          animate()
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )

    observer.observe(element)

    function animate() {
      const start = performance.now()

      function tick(now: number) {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        /* Ease-out cubic for a decelerating feel */
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = eased * target

        setDisplayValue(current.toFixed(decimals))

        if (progress < 1) {
          requestAnimationFrame(tick)
        }
      }

      requestAnimationFrame(tick)
    }

    return () => observer.disconnect()
  }, [target, duration, decimals])

  return (
    <span ref={elementRef} className={className}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  )
}

export { CountUp }
export type { CountUpProps }

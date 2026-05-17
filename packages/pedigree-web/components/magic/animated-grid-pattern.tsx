/** Subtle animated background grid with randomly fading squares. */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/** Number of grid columns to render. */
const GRID_COLS = 20

/** Number of grid rows to render. */
const GRID_ROWS = 12

/** Maximum number of simultaneously active squares. */
const MAX_ACTIVE = 6

/** Duration range in ms for a square's fade cycle. */
const DURATION_MIN = 2000
const DURATION_RANGE = 3000

/**
 * Props for the AnimatedGridPattern component.
 */
interface AnimatedGridPatternProps {
  /** Additional CSS classes for the grid container. */
  className?: string
}

/**
 * A background grid of squares where random cells fade in and out.
 *
 * Uses requestAnimationFrame and opacity transitions rather than
 * animating layout properties. The effect creates a subtle, living
 * texture without being distracting. Pauses entirely when the user
 * prefers reduced motion.
 */
function AnimatedGridPattern({ className }: AnimatedGridPatternProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const activeSquares = React.useRef(new Set<number>())
  const rafId = React.useRef<number>(0)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const totalSquares = GRID_COLS * GRID_ROWS
    const squares = container.querySelectorAll<HTMLDivElement>('[data-grid-square]')

    function activateRandom() {
      if (activeSquares.current.size >= MAX_ACTIVE) return

      let index: number
      do {
        index = Math.floor(Math.random() * totalSquares)
      } while (activeSquares.current.has(index))

      const square = squares[index]
      if (!square) return

      activeSquares.current.add(index)
      square.style.opacity = '1'

      const duration = DURATION_MIN + Math.random() * DURATION_RANGE
      setTimeout(() => {
        square.style.opacity = '0'
        setTimeout(() => {
          activeSquares.current.delete(index)
        }, 600)
      }, duration)
    }

    let lastTick = 0
    function tick(timestamp: number) {
      if (timestamp - lastTick > 400) {
        activateRandom()
        lastTick = timestamp
      }
      rafId.current = requestAnimationFrame(tick)
    }

    rafId.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId.current)
    }
  }, [])

  const squares = React.useMemo(() => {
    const cells: React.ReactNode[] = []
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      cells.push(
        <div
          key={i}
          data-grid-square=""
          className="rounded-sm bg-accent/5 opacity-0 transition-opacity duration-700 dark:bg-accent-dark/5"
        />,
      )
    }
    return cells
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div
        className="grid h-full w-full gap-1"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
        }}
      >
        {squares}
      </div>
    </div>
  )
}

export { AnimatedGridPattern }
export type { AnimatedGridPatternProps }

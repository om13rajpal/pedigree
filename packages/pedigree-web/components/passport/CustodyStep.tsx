/** Individual step in the chain of custody vertical timeline. */

'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Status determines the color of the step's icon circle. */
type StepStatus = 'success' | 'warning' | 'error' | 'neutral'

/** Style mapping from step status to Tailwind classes. */
const STATUS_STYLES: Record<StepStatus, { bg: string; text: string; line: string }> = {
  success: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-success',
    line: 'bg-success/20',
  },
  warning: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-warning',
    line: 'bg-warning/20',
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-error',
    line: 'bg-error/20',
  },
  neutral: {
    bg: 'bg-neutral-100 dark:bg-neutral-800',
    text: 'text-neutral-500 dark:text-neutral-400',
    line: 'bg-neutral-200 dark:bg-neutral-700',
  },
}

/**
 * Props for the CustodyStep component.
 */
interface CustodyStepProps {
  /** Lucide icon component to render in the step circle. */
  icon: LucideIcon
  /** The step's headline label. */
  title: string
  /** A brief description shown below the title. */
  subtitle: string
  /** Visual status controlling icon circle and line color. */
  status: StepStatus
  /** Whether to show the vertical connecting line below this step. */
  isLast?: boolean
  /** Optional rich content rendered below the subtitle. */
  children?: React.ReactNode
}

/**
 * A single step in the chain of custody timeline.
 *
 * Renders an icon in a colored circle on the left, connected by a
 * vertical line to subsequent steps. Title, subtitle, and optional
 * detail content appear on the right. Uses motion.div for staggered
 * entrance from the parent container.
 *
 * @param icon - The Lucide icon to display.
 * @param title - Headline text for the step.
 * @param subtitle - Supporting description.
 * @param status - Visual status (success, warning, error, neutral).
 * @param isLast - When true, hides the connecting line below.
 * @param children - Optional detail content below the subtitle.
 */
export function CustodyStep({
  icon: Icon,
  title,
  subtitle,
  status,
  isLast = false,
  children,
}: CustodyStepProps) {
  const styles = STATUS_STYLES[status]

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
      }}
      className="relative flex gap-4"
    >
      {/* Left column: icon circle + connecting line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            styles.bg,
          )}
        >
          <Icon className={cn('h-4 w-4', styles.text)} aria-hidden="true" />
        </div>
        {!isLast && <div className={cn('mt-1 w-px flex-1', styles.line)} aria-hidden="true" />}
      </div>

      {/* Right column: text content */}
      <div className={cn('pb-6', isLast && 'pb-0')}>
        <p className="text-xs font-semibold text-neutral-950 dark:text-neutral-50">{title}</p>
        <p className="mt-0.5 text-2xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </motion.div>
  )
}

export type { StepStatus, CustodyStepProps }

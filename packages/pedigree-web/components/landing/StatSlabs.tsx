/** Three stat cards with animated counters and staggered entrance. */

'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { useRespectMotion } from '@/components/motion/respect-motion'
import { DEFAULT_SPRING } from '@/components/motion/springs'
import { CountUp } from './count-up'

/** Stagger interval between stat cards in seconds. */
const STAGGER_INTERVAL = 0.06

/**
 * Configuration for a single stat card.
 */
interface StatConfig {
  /** The numeric value for the CountUp animation. */
  target: number
  /** Number of decimal places. */
  decimals: number
  /** Prefix displayed before the number. */
  prefix: string
  /** Suffix displayed after the number. */
  suffix: string
  /** Primary label below the number. */
  label: string
  /** Attribution or source citation. */
  cite: string
}

/** The three stat cards to render on the landing page. */
const STATS: readonly StatConfig[] = [
  {
    target: 42,
    decimals: 0,
    prefix: '',
    suffix: '%',
    label: 'of code committed today is AI-assisted',
    cite: 'Sonar, 2025',
  },
  {
    target: 15,
    decimals: 0,
    prefix: '€',
    suffix: 'M',
    label: 'maximum fine under EU AI Act Article 50',
    cite: 'EU AI Act',
  },
  {
    target: 2,
    decimals: 0,
    prefix: '< ',
    suffix: 's',
    label: 'to verify a commit’s full chain of custody',
    cite: 'Pedigree benchmark',
  },
] as const

/**
 * Container animation variants for staggering stat cards.
 */
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STAGGER_INTERVAL,
    },
  },
}

/**
 * Individual card animation variants -- fade up.
 */
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

/**
 * Three stat slabs that anchor the landing page value proposition.
 *
 * Numbers animate with a count-up effect when scrolled into view.
 * Cards enter with a staggered fade-up using Framer Motion springs.
 * Respects prefers-reduced-motion by disabling entrance animation.
 */
function StatSlabs() {
  const { transition, isReduced } = useRespectMotion(DEFAULT_SPRING)

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24">
      <motion.div
        className="grid gap-6 sm:grid-cols-3"
        variants={containerVariants}
        initial={isReduced ? 'visible' : 'hidden'}
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        {STATS.map((stat) => (
          <motion.div
            key={stat.label}
            className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200/60 bg-white p-8 shadow-subtle dark:border-neutral-700/60 dark:bg-neutral-900"
            variants={cardVariants}
            transition={transition}
          >
            <span className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
              <CountUp
                target={stat.target}
                prefix={stat.prefix}
                suffix={stat.suffix}
                decimals={stat.decimals}
              />
            </span>
            <p className="text-center text-xs text-neutral-600 dark:text-neutral-400">
              {stat.label}
            </p>
            <cite className="text-2xs not-italic text-neutral-400 dark:text-neutral-500">
              {stat.cite}
            </cite>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}

export { StatSlabs }

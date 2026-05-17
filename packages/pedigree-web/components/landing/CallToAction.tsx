/** Final call-to-action section with shimmer button and demo link. */

'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRespectMotion } from '@/components/motion/respect-motion'
import { DEFAULT_SPRING } from '@/components/motion/springs'
import { ShimmerButton } from '@/components/magic/shimmer-button'

/** Real attested commit SHA for the primary CTA. */
const DEMO_SHA = '4a2167236fe88df14bfa51eabf38c27c4fd1fb7c'

/** Stagger delay between children in seconds. */
const STAGGER_DELAY = 0.05

/**
 * Container animation variants.
 */
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STAGGER_DELAY,
    },
  },
}

/**
 * Child animation variants -- fade up from below.
 */
const childVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

/**
 * Closing CTA section encouraging visitors to try a live passport.
 *
 * Features a heading, shimmer CTA button linking to the demo passport,
 * and a reassuring subline. All motion respects prefers-reduced-motion.
 */
function CallToAction() {
  const { transition, isReduced } = useRespectMotion(DEFAULT_SPRING)

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24">
      <motion.div
        className="flex flex-col items-center gap-6 text-center"
        variants={containerVariants}
        initial={isReduced ? 'visible' : 'hidden'}
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
      >
        <motion.h2
          className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-2xl"
          variants={childVariants}
          transition={transition}
        >
          Try Pedigree on a real commit
        </motion.h2>

        <motion.div variants={childVariants} transition={transition}>
          <Link href={`/passport/${DEMO_SHA}`}>
            <ShimmerButton>See a live passport</ShimmerButton>
          </Link>
        </motion.div>

        <motion.p
          className="text-xs text-neutral-500 dark:text-neutral-400"
          variants={childVariants}
          transition={transition}
        >
          No signup. No install. Just scan.
        </motion.p>
      </motion.div>
    </section>
  )
}

export { CallToAction }

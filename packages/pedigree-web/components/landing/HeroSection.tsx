/** Hero section with headline, passport preview, and shimmer CTA. */

'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Shield, CheckCircle, Fingerprint } from 'lucide-react'
import { useRespectMotion } from '@/components/motion/respect-motion'
import { GENTLE_SPRING } from '@/components/motion/springs'
import { AnimatedGridPattern } from '@/components/magic/animated-grid-pattern'
import { BorderBeam } from '@/components/magic/border-beam'
import { ShimmerButton } from '@/components/magic/shimmer-button'
import { cn } from '@/lib/utils'

/** Stagger delay in seconds between child elements. */
const STAGGER_DELAY = 0.05

/** Real attested commit SHA for the hero CTA. */
const DEMO_SHA = '4a2167236fe88df14bfa51eabf38c27c4fd1fb7c'

/**
 * Container animation variants for staggering children on mount.
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
 * Individual child animation variants -- fade up from below.
 */
const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

/**
 * The landing page hero with heading, description, passport preview, and CTA.
 *
 * Features a subtle animated grid background, a floating passport preview
 * card with a border beam effect, and a shimmer CTA button. All animations
 * respect the user's reduced-motion preference.
 */
function HeroSection() {
  const { transition, isReduced } = useRespectMotion(GENTLE_SPRING)

  return (
    <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 py-24">
      <AnimatedGridPattern className="opacity-60" />

      <motion.div
        className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-12 text-center lg:flex-row lg:gap-16 lg:text-left"
        variants={containerVariants}
        initial={isReduced ? 'visible' : 'hidden'}
        animate="visible"
      >
        <div className="flex max-w-xl flex-col gap-6">
          <motion.div variants={childVariants} transition={transition}>
            <span className="inline-flex items-center gap-2 rounded-sm bg-accent-subtle px-3 py-1 font-mono text-2xs font-medium text-accent dark:bg-accent-subtle dark:text-accent-dark">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              C2PA for source code
            </span>
          </motion.div>

          <motion.h1
            className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl"
            variants={childVariants}
            transition={transition}
          >
            Every AI commit deserves a{' '}
            <span className="font-display text-accent dark:text-accent-dark">passport</span>
          </motion.h1>

          <motion.p
            className="text-sm text-neutral-600 dark:text-neutral-400 sm:text-base"
            variants={childVariants}
            transition={transition}
          >
            Pedigree signs every AI-assisted commit with a cryptographic attestation, anchored in a
            public transparency log. Know who wrote every line -- human or machine -- before the EU
            AI Act deadline hits.
          </motion.p>

          <motion.div
            className="flex flex-col items-center gap-4 sm:flex-row lg:items-start"
            variants={childVariants}
            transition={transition}
          >
            <Link href={`/passport/${DEMO_SHA}`}>
              <ShimmerButton>See a live passport</ShimmerButton>
            </Link>
            <Link
              href="https://github.com/om13rajpal/pedigree"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 underline-offset-4 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-neutral-400 dark:hover:text-neutral-50"
            >
              View on GitHub
            </Link>
          </motion.div>
        </div>

        <motion.div
          className="relative w-full max-w-sm"
          variants={childVariants}
          transition={transition}
        >
          <PassportPreview />
        </motion.div>
      </motion.div>
    </section>
  )
}

/**
 * A decorative passport card preview showing key attestation fields.
 *
 * Uses the border beam effect for a rotating highlight and displays
 * mock predicate data to preview the product.
 */
function PassportPreview() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-neutral-200/60 bg-white p-6 shadow-lifted dark:border-neutral-700/60 dark:bg-neutral-900">
      <BorderBeam />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-accent dark:text-accent-dark" aria-hidden="true" />
            <span className="text-xs font-semibold text-neutral-950 dark:text-neutral-50">
              Code Passport
            </span>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-2xs font-medium',
              'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
            )}
          >
            <CheckCircle className="h-3 w-3" aria-hidden="true" />
            Verified
          </span>
        </div>

        <div className="space-y-3">
          <PreviewField label="Commit" value="4a21672" mono />
          <PreviewField label="Author" value="ibm-bob (AI-assisted)" />
          <PreviewField label="Model" value="granite-3.3-8b" mono />
          <PreviewField label="Human share" value="15%" />
          <PreviewField label="Policy" value="Satisfied" />
          <PreviewField label="Logged in" value="Rekor transparency log" />
        </div>

        <div className="h-px bg-neutral-200/60 dark:bg-neutral-700/60" />

        <p className="text-center font-mono text-2xs text-neutral-400 dark:text-neutral-500">
          dev.pedigree/ai-authorship/v1
        </p>
      </div>
    </div>
  )
}

/**
 * Props for a single field row in the passport preview.
 */
interface PreviewFieldProps {
  /** The field label. */
  label: string
  /** The field value. */
  value: string
  /** Whether to render the value in monospace. */
  mono?: boolean
}

/**
 * A label-value row inside the passport preview card.
 */
function PreviewField({ label, value, mono = false }: PreviewFieldProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-2xs text-neutral-500 dark:text-neutral-400">{label}</span>
      <span
        className={cn(
          'text-2xs font-medium text-neutral-900 dark:text-neutral-100',
          mono && 'font-mono',
        )}
      >
        {value}
      </span>
    </div>
  )
}

export { HeroSection }

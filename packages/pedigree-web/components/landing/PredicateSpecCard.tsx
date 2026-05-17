/** Syntax-highlighted predicate JSON preview card. */

'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { FileCode, ArrowRight } from 'lucide-react'
import { useRespectMotion } from '@/components/motion/respect-motion'
import { GENTLE_SPRING } from '@/components/motion/springs'
import { Line, Key, StringVal, NumberVal, BoolVal, Punctuation, Bracket } from './json-tokens'

/**
 * Container variants for staggering JSON lines.
 */
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.03,
    },
  },
}

/**
 * A styled card displaying an abbreviated predicate JSON with syntax coloring.
 *
 * Renders a dark code block showing the essential shape of the
 * dev.pedigree/ai-authorship/v1 predicate. Syntax highlighting is
 * applied via inline spans rather than a third-party library.
 * Lines stagger in from the left on scroll intersection.
 */
function PredicateSpecCard() {
  const { transition, isReduced } = useRespectMotion(GENTLE_SPRING)

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24">
      <motion.div
        className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-lifted"
        initial={isReduced ? 'visible' : 'hidden'}
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={containerVariants}
      >
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <FileCode className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <span className="font-mono text-2xs text-neutral-400">in-toto-statement.json</span>
        </div>

        <div className="overflow-x-auto p-4">
          <pre className="font-mono text-2xs leading-relaxed sm:text-xs">
            <Line transition={transition}>
              <Bracket>{'{'}</Bracket>
            </Line>
            <Line transition={transition} indent={1}>
              <Key>predicateType</Key>
              <Punctuation>: </Punctuation>
              <StringVal>dev.pedigree/ai-authorship/v1</StringVal>
              <Punctuation>,</Punctuation>
            </Line>
            <Line transition={transition} indent={1}>
              <Key>predicate</Key>
              <Punctuation>{': {'}</Punctuation>
            </Line>
            <Line transition={transition} indent={2}>
              <Key>authorship</Key>
              <Punctuation>{': {'}</Punctuation>
            </Line>
            <Line transition={transition} indent={3}>
              <Key>kind</Key>
              <Punctuation>: </Punctuation>
              <StringVal>ai-assisted</StringVal>
              <Punctuation>,</Punctuation>
            </Line>
            <Line transition={transition} indent={3}>
              <Key>humanShare</Key>
              <Punctuation>: </Punctuation>
              <NumberVal>0.15</NumberVal>
            </Line>
            <Line transition={transition} indent={2}>
              <Bracket>{'}'}</Bracket>
              <Punctuation>,</Punctuation>
            </Line>
            <Line transition={transition} indent={2}>
              <Key>agent</Key>
              <Punctuation>{': {'}</Punctuation>
            </Line>
            <Line transition={transition} indent={3}>
              <Key>tool</Key>
              <Punctuation>: </Punctuation>
              <StringVal>ibm-bob</StringVal>
              <Punctuation>,</Punctuation>
            </Line>
            <Line transition={transition} indent={3}>
              <Key>model</Key>
              <Punctuation>: </Punctuation>
              <StringVal>granite-3.3-8b</StringVal>
            </Line>
            <Line transition={transition} indent={2}>
              <Bracket>{'}'}</Bracket>
              <Punctuation>,</Punctuation>
            </Line>
            <Line transition={transition} indent={2}>
              <Key>policy</Key>
              <Punctuation>{': { '}</Punctuation>
              <Key>satisfied</Key>
              <Punctuation>: </Punctuation>
              <BoolVal>true</BoolVal>
              <Punctuation>{' }'}</Punctuation>
            </Line>
            <Line transition={transition} indent={1}>
              <Bracket>{'}'}</Bracket>
            </Line>
            <Line transition={transition}>
              <Bracket>{'}'}</Bracket>
            </Line>
          </pre>
        </div>

        <div className="flex items-center justify-end border-t border-neutral-800 px-4 py-3">
          <Link
            href="/docs/predicate-spec"
            className="group inline-flex items-center gap-1 text-2xs font-medium text-neutral-400 transition-colors hover:text-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Read the full spec
            <ArrowRight
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </motion.div>
    </section>
  )
}

export { PredicateSpecCard }

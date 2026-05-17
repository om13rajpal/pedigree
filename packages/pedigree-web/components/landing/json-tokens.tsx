/** Syntax-coloring primitives for rendering JSON tokens in code blocks. */

import * as React from 'react'
import { motion } from 'framer-motion'

/**
 * Framer Motion variants for individual line entrance animation.
 */
export const lineVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
}

/**
 * Props for the Line wrapper component.
 */
interface LineProps {
  children: React.ReactNode
  /** Indentation level (each level = 2ch). */
  indent?: number
  /** Framer Motion transition config. */
  transition: Record<string, unknown>
}

/** A single animated line in the code block. */
export function Line({ children, indent = 0, transition }: LineProps) {
  return (
    <motion.div
      className="whitespace-pre"
      style={{ paddingLeft: `${indent * 2}ch` }}
      variants={lineVariants}
      transition={transition}
    >
      {children}
    </motion.div>
  )
}

/** JSON key text (teal accent). */
export function Key({ children }: { children: React.ReactNode }) {
  return <span className="text-teal-400">&quot;{children}&quot;</span>
}

/** JSON string value (amber). */
export function StringVal({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-300">&quot;{children}&quot;</span>
}

/** JSON number value (purple). */
export function NumberVal({ children }: { children: React.ReactNode }) {
  return <span className="text-purple-400">{children}</span>
}

/** JSON boolean value (blue). */
export function BoolVal({ children }: { children: React.ReactNode }) {
  return <span className="text-sky-400">{children}</span>
}

/** JSON punctuation (dim neutral). */
export function Punctuation({ children }: { children: React.ReactNode }) {
  return <span className="text-neutral-500">{children}</span>
}

/** JSON bracket (brighter neutral). */
export function Bracket({ children }: { children: React.ReactNode }) {
  return <span className="text-neutral-400">{children}</span>
}

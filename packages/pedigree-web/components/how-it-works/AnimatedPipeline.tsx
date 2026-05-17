'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Code2, Bot, FileKey2, ShieldCheck, Database, Eye } from 'lucide-react'

interface PipelineNode {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const PIPELINE_NODES: readonly PipelineNode[] = [
  {
    id: 'code',
    label: 'Code Written',
    description: 'Developer or AI writes code',
    icon: Code2,
    color: 'text-blue-500 dark:text-blue-400',
  },
  {
    id: 'detect',
    label: 'Bob Detects',
    description: 'Provenance Officer activates',
    icon: Bot,
    color: 'text-violet-500 dark:text-violet-400',
  },
  {
    id: 'predicate',
    label: 'Predicate Built',
    description: 'MCP assembles metadata',
    icon: FileKey2,
    color: 'text-amber-500 dark:text-amber-400',
  },
  {
    id: 'sign',
    label: 'DSSE Signed',
    description: 'Envelope is signed',
    icon: ShieldCheck,
    color: 'text-emerald-500 dark:text-emerald-400',
  },
  {
    id: 'rekor',
    label: 'Rekor Logged',
    description: 'Transparency log anchors proof',
    icon: Database,
    color: 'text-cyan-500 dark:text-cyan-400',
  },
  {
    id: 'passport',
    label: 'Passport Ready',
    description: 'Chain of custody verifiable',
    icon: Eye,
    color: 'text-accent dark:text-accent-dark',
  },
] as const

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
}

const nodeVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

const connectorVariants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.4, ease: 'easeOut' } },
}

export function AnimatedPipeline() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-16 space-y-3 text-center"
      >
        <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-2xl">
          From keystroke to transparency log
        </h2>
        <p className="mx-auto max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          Every commit flows through six cryptographic checkpoints before it reaches your codebase.
        </p>
      </motion.div>

      {/* Desktop: horizontal pipeline */}
      <motion.div
        className="hidden items-start gap-0 md:flex md:justify-between"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        role="list"
        aria-label="Attestation pipeline"
      >
        {PIPELINE_NODES.map((node, i) => (
          <React.Fragment key={node.id}>
            {i > 0 && (
              <motion.div
                className="flex flex-1 items-center pt-7"
                variants={connectorVariants}
                style={{ originX: 0 }}
              >
                <div className="h-px w-full bg-gradient-to-r from-neutral-300 to-neutral-200 dark:from-neutral-600 dark:to-neutral-700" />
                <div
                  className="h-1.5 w-1.5 shrink-0 rotate-45 bg-neutral-300 dark:bg-neutral-600"
                  aria-hidden="true"
                />
              </motion.div>
            )}
            <motion.div
              variants={nodeVariants}
              role="listitem"
              className="flex w-28 flex-col items-center gap-3"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-neutral-200/60 bg-white shadow-subtle dark:border-neutral-700/60 dark:bg-neutral-900">
                <node.icon className={`h-6 w-6 ${node.color}`} aria-hidden="true" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs font-semibold text-neutral-950 dark:text-neutral-50">
                  {node.label}
                </p>
                <p className="text-2xs leading-snug text-neutral-500 dark:text-neutral-400">
                  {node.description}
                </p>
              </div>
            </motion.div>
          </React.Fragment>
        ))}
      </motion.div>

      {/* Mobile: vertical pipeline */}
      <motion.div
        className="flex flex-col gap-6 md:hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        role="list"
        aria-label="Attestation pipeline"
      >
        {PIPELINE_NODES.map((node, i) => (
          <motion.div
            key={node.id}
            variants={nodeVariants}
            role="listitem"
            className="flex items-start gap-4"
          >
            <div className="relative flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200/60 bg-white shadow-subtle dark:border-neutral-700/60 dark:bg-neutral-900">
                <node.icon className={`h-5 w-5 ${node.color}`} aria-hidden="true" />
              </div>
              {i < PIPELINE_NODES.length - 1 && (
                <div
                  className="mt-2 h-8 w-px bg-neutral-200 dark:bg-neutral-700"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="pt-1">
              <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                {node.label}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{node.description}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}

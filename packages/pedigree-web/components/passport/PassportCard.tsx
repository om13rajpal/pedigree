/** Hero card displaying commit identity and attestation summary at page top. */

'use client'

import { motion } from 'framer-motion'
import { FileCheck2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BorderBeam } from '@/components/magic/border-beam'
import { useRespectMotion } from '@/components/motion/respect-motion'
import { cn, formatSha, formatTimestamp } from '@/lib/utils'
import type { AttestationData } from '@/lib/attestation'

/** Map risk class values to Badge variants for visual differentiation. */
const RISK_VARIANT_MAP = {
  low: 'success',
  medium: 'warning',
  high: 'error',
} as const

/**
 * Props for the PassportCard component.
 */
interface PassportCardProps {
  /** The full attestation data to render in the card. */
  data: AttestationData
  /** Whether this attestation was fetched live from pedigree-mcp or is mock data. */
  source?: string
}

/**
 * The hero card at the top of the Passport page.
 *
 * Displays the commit SHA, author, message, timestamp, and risk badge.
 * Animates in on first render with a scale spring and a BorderBeam
 * highlight sweep around the card edge.
 *
 * @param data - The attestation data for the commit being displayed.
 */
export function PassportCard({ data, source }: PassportCardProps) {
  const { transition } = useRespectMotion()
  const { commitMeta, predicate, isVerified } = data
  const riskClass = predicate.scope.riskClass
  const riskVariant = RISK_VARIANT_MAP[riskClass]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={transition}
      className="relative w-full"
    >
      <Card className="relative overflow-hidden">
        <BorderBeam duration={6} />
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-md',
                'bg-accent-subtle dark:bg-accent-dark/10',
              )}
            >
              <FileCheck2
                className="h-5 w-5 text-accent dark:text-accent-dark"
                aria-hidden="true"
              />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                Code Passport
              </h1>
              <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                AI Authorship Attestation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isVerified ? (
              <Badge variant="success">Verified</Badge>
            ) : (
              <Badge variant="warning">Unverified</Badge>
            )}
            <Badge variant={riskVariant}>{riskClass} risk</Badge>
            {(source === 'live' || source === 'cached') && (
              <Badge
                variant="outline"
                className="border-accent text-accent dark:border-accent-dark dark:text-accent-dark"
              >
                {source === 'live' ? 'Live' : 'Signed'}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Commit SHA hero display */}
          <div className="space-y-1">
            <p className="text-2xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Commit
            </p>
            <p className="font-mono text-lg font-semibold text-accent dark:text-accent-dark">
              {formatSha(data.sha)}
            </p>
            <p className="font-mono text-2xs text-neutral-400 dark:text-neutral-500">{data.sha}</p>
          </div>

          {/* Author and message */}
          <div className="space-y-2 border-t border-neutral-200/60 pt-4 dark:border-neutral-700/60">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xs font-medium text-neutral-950 dark:text-neutral-50">
                {commitMeta.author}
              </p>
              <time
                dateTime={commitMeta.timestamp}
                className="text-2xs text-neutral-400 dark:text-neutral-500"
              >
                {formatTimestamp(commitMeta.timestamp)}
              </time>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">{commitMeta.message}</p>
          </div>

          {/* Agent summary */}
          {predicate.agent && (
            <div className="flex flex-wrap gap-2 border-t border-neutral-200/60 pt-4 dark:border-neutral-700/60">
              <Badge variant="outline">{predicate.agent.tool}</Badge>
              <Badge variant="outline">{predicate.agent.model}</Badge>
              <Badge variant="secondary">{predicate.authorship.kind}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

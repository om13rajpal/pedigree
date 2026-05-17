/** Vertical timeline showing the full chain of custody for a commit. */

'use client'

import { motion } from 'framer-motion'
import {
  GitCommitHorizontal,
  Bot,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useRespectMotion } from '@/components/motion/respect-motion'
import { Badge } from '@/components/ui/badge'
import { cn, formatTimestamp } from '@/lib/utils'
import { CustodyStep } from './CustodyStep'
import type { AttestationData } from '@/lib/attestation'

/** Stagger interval in seconds between sibling step animations. */
const STAGGER_INTERVAL = 0.06

/**
 * Props for the ChainOfCustody component.
 */
interface ChainOfCustodyProps {
  /** The full attestation data to derive timeline steps from. */
  data: AttestationData
}

/**
 * Inline copy button that writes text to the clipboard.
 *
 * Shows a brief "Copied" confirmation, then reverts after 1.5 seconds.
 * Designed for copying UUIDs and hashes within timeline steps.
 *
 * @param text - The string to copy to the clipboard.
 * @param label - Accessible label describing what is being copied.
 */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs',
        'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700',
        'dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'transition-colors',
      )}
    >
      <Copy className="h-3 w-3" aria-hidden="true" />
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

/**
 * Renders a vertical timeline of custody steps derived from attestation data.
 *
 * Five steps are always rendered in order:
 * 1. Origin -- commit author and timestamp
 * 2. Agent Signature -- the AI tool, model, and mode used
 * 3. Human Approval -- whether a human reviewed and approved
 * 4. Sigstore Witness -- Fulcio certificate subject and Rekor UUID
 * 5. Verification Status -- whether the full chain is verified
 *
 * Steps animate in with a 60ms stagger using Framer Motion variants.
 * Respects prefers-reduced-motion by collapsing to a quick fade.
 *
 * @param data - The attestation data to visualize.
 */
export function ChainOfCustody({ data }: ChainOfCustodyProps) {
  const { transition, isReduced } = useRespectMotion()
  const { predicate, commitMeta, rekorUuid, isVerified } = data

  const hasApproval = predicate.authorship.humanApprover?.approved === true
  const approverSubject = predicate.authorship.humanApprover?.subject

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: isReduced ? 0 : STAGGER_INTERVAL,
      },
    },
  }

  return (
    <section aria-label="Chain of custody timeline">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        Chain of Custody
      </h2>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        transition={transition}
        className="flex flex-col"
      >
        {/* Step 1: Origin */}
        <CustodyStep
          icon={GitCommitHorizontal}
          title="Origin"
          subtitle={`${commitMeta.author} committed on ${formatTimestamp(commitMeta.timestamp)}`}
          status="neutral"
        >
          <p className="font-mono text-2xs text-neutral-500 dark:text-neutral-400">
            {commitMeta.email}
          </p>
        </CustodyStep>

        {/* Step 2: Agent Signature */}
        {predicate.agent && predicate.execution && (
          <CustodyStep
            icon={Bot}
            title="Agent Signature"
            subtitle={`${predicate.agent.tool} v${predicate.agent.toolVersion} using ${predicate.agent.model}`}
            status="neutral"
          >
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{predicate.agent.modelProvider}</Badge>
              <Badge variant="outline">mode: {predicate.execution.modeSlug}</Badge>
              {predicate.execution.skillHashes.map((skill) => (
                <Badge key={skill.name} variant="secondary">
                  {skill.name}
                </Badge>
              ))}
            </div>
          </CustodyStep>
        )}

        {/* Step 3: Human Approval */}
        <CustodyStep
          icon={hasApproval ? UserCheck : XCircle}
          title="Human Approval"
          subtitle={
            hasApproval
              ? `Approved by ${approverSubject ?? 'unknown'}`
              : 'No human approval recorded'
          }
          status={hasApproval ? 'success' : 'warning'}
        >
          {predicate.authorship.humanApprover && (
            <p className="text-2xs text-neutral-500 dark:text-neutral-400">
              via <span className="font-mono">{predicate.authorship.humanApprover.oidcIssuer}</span>
            </p>
          )}
        </CustodyStep>

        {/* Step 4: Sigstore Witness */}
        <CustodyStep
          icon={ShieldCheck}
          title="Cryptographic Signature"
          subtitle={rekorUuid ? 'Signed with ed25519 keypair' : 'No signature recorded'}
          status={rekorUuid ? 'success' : 'warning'}
        >
          {rekorUuid && (
            <div className="flex items-center gap-2">
              <code className="font-mono text-2xs text-neutral-500 dark:text-neutral-400">
                {rekorUuid.slice(0, 24)}...
              </code>
              <CopyButton text={rekorUuid} label="Copy signer identity" />
            </div>
          )}
        </CustodyStep>

        {/* Step 5: Verification Status */}
        <CustodyStep
          icon={isVerified ? CheckCircle2 : XCircle}
          title="Verification Status"
          subtitle={
            isVerified ? 'Full chain of custody verified' : 'Chain of custody could not be verified'
          }
          status={isVerified ? 'success' : 'error'}
          isLast
        >
          <Badge variant={isVerified ? 'success' : 'error'}>
            {isVerified ? 'Verified' : 'Not Verified'}
          </Badge>
        </CustodyStep>
      </motion.div>
    </section>
  )
}

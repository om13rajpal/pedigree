/**
 * Template-based summary generator for attestation predicates.
 *
 * This module provides a fallback mechanism when watsonx.ai is unavailable.
 * It generates human-readable summaries using predicate fields and template
 * strings, maintaining the same output format as AI-generated summaries.
 */

import type { PedigreePredicate, Authorship, Agent, Scope, Policy } from 'pedigree-types'
import type { CommitMeta } from './mock-attestation'

/**
 * Generates a human-readable summary from a predicate using templates.
 *
 * This function serves as a fallback when watsonx.ai is unreachable. It
 * produces 2-3 sentence summaries that explain the authorship model, scope
 * of changes, and policy compliance status.
 *
 * @param predicate - The validated Pedigree predicate to summarize.
 * @param commitMeta - Human-readable commit metadata.
 * @returns A 2-3 sentence summary string.
 */
export function generateTemplateSummary(
  predicate: PedigreePredicate,
  commitMeta: CommitMeta,
): string {
  const { authorship, agent, scope, policy } = predicate

  // Part 1: Authorship description
  const authorshipDesc = formatAuthorship(authorship, agent)

  // Part 2: Scope description
  const scopeDesc = formatScope(scope, commitMeta)

  // Part 3: Policy compliance
  const policyDesc = formatPolicy(policy, authorship)

  return `${authorshipDesc} ${scopeDesc} ${policyDesc}`
}

/**
 * Formats the authorship section based on the kind discriminator.
 */
function formatAuthorship(authorship: Authorship, agent?: Agent): string {
  switch (authorship.kind) {
    case 'human':
      return 'This commit was written entirely by a human developer.'

    case 'ai-assisted': {
      const humanPct = Math.round((authorship.humanShare ?? 0) * 100)
      const toolName = agent?.tool ?? 'an AI agent'
      const modelName = agent?.model ?? 'an unknown model'

      return `This commit was produced through AI-assisted development (${humanPct}% human contribution) using ${toolName} with the ${modelName} model.`
    }

    case 'ai-autonomous': {
      const toolName = agent?.tool ?? 'an AI agent'
      const modelName = agent?.model ?? 'an unknown model'

      return `This commit was generated autonomously by ${toolName} using the ${modelName} model.`
    }
  }
}

/**
 * Formats the scope section describing files changed and risk level.
 */
function formatScope(scope: Scope, _commitMeta: CommitMeta): string {
  const fileCount = scope.filesTouched.length
  const fileList = scope.filesTouched.slice(0, 3).join(', ')
  const moreFiles = fileCount > 3 ? ` and ${fileCount - 3} more` : ''
  const filePlural = fileCount === 1 ? 'file' : 'files'

  return `The changes modified ${fileCount} ${scope.riskClass}-risk ${filePlural} (${fileList}${moreFiles}), adding ${scope.linesAdded} lines and removing ${scope.linesDeleted}.`
}

/**
 * Formats the policy compliance section.
 */
function formatPolicy(policy: Policy, authorship: Authorship): string {
  if (!policy.requiresHumanApproval) {
    return `No human approval was required for this ${authorship.kind} commit.`
  }

  const approver = authorship.humanApprover
  if (approver?.approved) {
    return `Human approval was required and granted by ${approver.subject}, satisfying the repository's provenance policy.`
  }

  if (approver && !approver.approved) {
    return `Human approval was required but not granted by ${approver.subject}, violating the repository's provenance policy.`
  }

  return `Human approval was required but not recorded, violating the repository's provenance policy.`
}

/**
 * Generates a concise one-line summary for display in lists or cards.
 *
 * @param predicate - The validated Pedigree predicate.
 * @returns A single sentence summary (< 100 characters).
 */
export function generateShortSummary(predicate: PedigreePredicate): string {
  const { authorship, agent, scope } = predicate

  const kindLabel =
    authorship.kind === 'ai-assisted'
      ? 'AI-assisted'
      : authorship.kind === 'ai-autonomous'
        ? 'AI-autonomous'
        : 'Human'

  const toolName = agent?.tool ?? 'unknown'
  const fileCount = scope.filesTouched.length

  return `${kindLabel} commit by ${toolName} • ${fileCount} ${
    fileCount === 1 ? 'file' : 'files'
  } • ${scope.riskClass} risk`
}

// Made with Bob

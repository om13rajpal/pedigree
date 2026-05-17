/**
 * Prompt builder for watsonx.ai Granite 3.3 8B Instruct.
 *
 * This module constructs prompts from Pedigree predicates, optimized for
 * the Granite 3.3 8B Instruct model to generate concise, factual summaries.
 */

import type { PedigreePredicate } from 'pedigree-types'
import type { CommitMeta } from './mock-attestation'

/** System prompt for Granite 3.3 8B Instruct. */
const SYSTEM_PROMPT = `You are a technical documentation assistant specializing in software provenance and AI-generated code transparency. Your task is to explain code attestations in clear, concise language suitable for developers and auditors.

Generate a 2-3 sentence summary that explains:
1. Who or what authored the code (human, AI-assisted, or AI-autonomous)
2. What changed and the risk level
3. Whether policy requirements were satisfied

Be factual, avoid speculation, and use active voice.`

/**
 * Builds a prompt for watsonx.ai from a predicate and commit metadata.
 *
 * The prompt is structured to extract key information from the predicate
 * and present it in a format optimized for Granite 3.3 8B Instruct.
 *
 * @param predicate - The validated Pedigree predicate.
 * @param _commitMeta - Human-readable commit metadata (reserved for future use).
 * @returns A formatted prompt string ready for watsonx.ai.
 */
export function buildPrompt(predicate: PedigreePredicate, _commitMeta: CommitMeta): string {
  const { authorship, agent, scope, policy } = predicate

  // Format file list (show first 3, indicate if more)
  const fileList = scope.filesTouched.slice(0, 3).join(', ')
  const moreFiles = scope.filesTouched.length > 3 ? `... (${scope.filesTouched.length} total)` : ''

  // Build the user prompt
  const userPrompt = `Summarize this code attestation predicate in 2-3 sentences:

Authorship: ${authorship.kind}
Human Contribution: ${formatHumanShare(authorship.humanShare)}
Human Approver: ${formatApprover(authorship.humanApprover)}
AI Agent: ${formatAgent(agent)}
AI Model: ${formatModel(agent)}
Files Changed: ${scope.filesTouched.length} files (${fileList}${moreFiles})
Lines: +${scope.linesAdded} -${scope.linesDeleted}
Risk Class: ${scope.riskClass}
Policy Satisfied: ${policy.satisfied}
Human Approval Required: ${policy.requiresHumanApproval}

Focus on the authorship model, risk level, and policy compliance.`

  return `${SYSTEM_PROMPT}\n\n${userPrompt}`
}

/**
 * Formats the human share value for display.
 */
function formatHumanShare(humanShare: number | null | undefined): string {
  if (humanShare === null || humanShare === undefined) {
    return 'none'
  }
  return `${Math.round(humanShare * 100)}%`
}

/**
 * Formats the human approver information.
 */
function formatApprover(approver: { subject: string; approved: boolean } | undefined): string {
  if (!approver) {
    return 'none'
  }
  return `${approver.subject} (approved: ${approver.approved})`
}

/**
 * Formats the AI agent tool information.
 */
function formatAgent(agent: { tool: string; toolVersion: string } | undefined): string {
  if (!agent) {
    return 'N/A'
  }
  return `${agent.tool} v${agent.toolVersion}`
}

/**
 * Formats the AI model information.
 */
function formatModel(agent: { model: string; modelProvider: string } | undefined): string {
  if (!agent) {
    return 'N/A'
  }
  return `${agent.model} (${agent.modelProvider})`
}

/**
 * Extracts key fields from a predicate for logging/monitoring.
 *
 * @param predicate - The predicate to extract fields from.
 * @returns An object with key predicate fields for structured logging.
 */
export function extractPredicateFields(predicate: PedigreePredicate) {
  return {
    authorshipKind: predicate.authorship.kind,
    humanShare: predicate.authorship.humanShare,
    approved: predicate.authorship.humanApprover?.approved ?? null,
    agentTool: predicate.agent?.tool ?? null,
    agentModel: predicate.agent?.model ?? null,
    fileCount: predicate.scope.filesTouched.length,
    linesAdded: predicate.scope.linesAdded,
    linesDeleted: predicate.scope.linesDeleted,
    riskClass: predicate.scope.riskClass,
    policySatisfied: predicate.policy.satisfied,
    requiresApproval: predicate.policy.requiresHumanApproval,
  }
}

// Made with Bob

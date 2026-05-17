/**
 * Zod schemas for the dev.pedigree/ai-authorship/v1 predicate.
 *
 * This file defines the canonical shape of a Pedigree predicate -- the payload
 * inside an in-toto Statement that records who (or what) authored a commit,
 * under which policy, and with what tooling context. The schema is the single
 * source of truth for TypeScript consumers; the Python mirror in pedigree-mcp
 * must stay in sync (verified by `pnpm verify-schemas`).
 *
 * Design decision: we use z.discriminatedUnion on `authorship.kind` so that
 * human-only commits don't need to provide agent/execution fields, while
 * AI-assisted and AI-autonomous commits carry full provenance context.
 */

import { z } from 'zod'
import { AUTHORSHIP_KINDS, RISK_CLASSES, SCHEMA_VERSION } from './constants'

// ---------------------------------------------------------------------------
// Shared refinement patterns
// ---------------------------------------------------------------------------

/**
 * Matches a lowercase hex string prefixed with `sha256:`.
 * Used for all hash fields except git commit SHA-1.
 */
const SHA256_PREFIXED_PATTERN = /^sha256:[0-9a-f]+$/

/** Validates a sha256-prefixed hash string. */
const sha256PrefixedHash = z
  .string()
  .regex(SHA256_PREFIXED_PATTERN, 'Hash must be lowercase hex prefixed with "sha256:"')

/**
 * Matches a lowercase hex string (no prefix).
 * Used for the git commit SHA-1 digest.
 */
const LOWERCASE_HEX_PATTERN = /^[0-9a-f]+$/

/** Validates a bare lowercase hex SHA-1 hash. */
export const sha1Hash = z
  .string()
  .regex(LOWERCASE_HEX_PATTERN, 'SHA-1 must be lowercase hex without prefix')

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/**
 * Human approver identity, established via OIDC during Sigstore signing.
 * Present when a human reviewed and approved the AI-authored commit.
 */
export const humanApproverSchema = z.object({
  /** The OIDC provider that authenticated the approver. */
  oidcIssuer: z.string().url(),
  /** The OIDC subject (typically an email). */
  subject: z.string().min(1),
  /** Whether the human explicitly approved the commit. */
  approved: z.boolean(),
  /** ISO-8601 timestamp of the approval action. */
  timestamp: z.string().datetime(),
})

/**
 * Agent metadata describing which AI tool produced the code.
 * Required for ai-assisted and ai-autonomous commits; absent for human-only.
 */
export const agentSchema = z.object({
  /** The agent tool name (e.g. "ibm-bob", "cursor", "windsurf"). */
  tool: z.string().min(1),
  /** Semver-ish version of the agent tool. */
  toolVersion: z.string().min(1),
  /** The model identifier used for code generation. */
  model: z.string().min(1),
  /** The provider hosting the model (e.g. "watsonx.ai", "anthropic"). */
  modelProvider: z.string().min(1),
})

/**
 * A content-addressed reference to a Bob Skill file.
 * The hash changes when the Skill changes, making workflow versions auditable.
 */
export const skillHashSchema = z.object({
  /** The Skill's slug name (e.g. "sign-on-commit"). */
  name: z.string().min(1),
  /** SHA-256 hex hash of the Skill's content. */
  sha256: z.string().regex(LOWERCASE_HEX_PATTERN, 'Skill hash must be lowercase hex'),
})

/**
 * Execution context capturing the agent's configuration at commit time.
 * Required for ai-assisted and ai-autonomous commits; absent for human-only.
 */
export const executionSchema = z.object({
  /** The Bob mode slug active during generation. */
  modeSlug: z.string().min(1),
  /** Content hashes of every Skill invoked during the session. */
  skillHashes: z.array(skillHashSchema).min(1),
  /** SHA-256 hash of the AGENTS.md file at commit time. */
  agentsMdHash: sha256PrefixedHash,
  /** SHA-256 hash of the prompt that initiated the task. */
  promptHash: sha256PrefixedHash,
  /** SHA-256 hash of the plan document (if any). */
  planHash: sha256PrefixedHash,
  /** Unique identifier for the Bob session. */
  bobSessionId: z.string().uuid(),
  /** Number of Bobcoins consumed during the session. */
  bobcoinsConsumed: z.number().nonnegative(),
})

/**
 * Scope of changes introduced by the commit.
 * Always required regardless of authorship kind.
 */
export const scopeSchema = z.object({
  /** Relative paths of files modified in the commit. */
  filesTouched: z.array(z.string().min(1)).min(1),
  /** Total lines added. */
  linesAdded: z.number().int().nonnegative(),
  /** Total lines deleted. */
  linesDeleted: z.number().int().nonnegative(),
  /** Risk classification derived from AGENTS.md risk classes. */
  riskClass: z.enum(RISK_CLASSES),
})

/**
 * Policy evaluation result -- records whether the commit satisfied
 * the repository's AGENTS.md provenance policy.
 */
export const policySchema = z.object({
  /** The policy version from the AGENTS.md Provenance section. */
  agentsMdPolicy: z.string().min(1),
  /** Whether the commit's risk class requires human approval. */
  requiresHumanApproval: z.boolean(),
  /**
   * Whether the policy was satisfied at commit time.
   * A `false` value MUST cause CI to fail.
   */
  satisfied: z.boolean(),
})

// ---------------------------------------------------------------------------
// Discriminated union on authorship.kind
// ---------------------------------------------------------------------------

/**
 * Authorship block for human-only commits.
 * Agent and execution context are not applicable.
 */
export const humanAuthorshipSchema = z.object({
  kind: z.literal('human'),
  /**
   * Fraction of code written by a human.
   * Typed as number in [0, 1] to stay consistent with other kinds.
   */
  humanShare: z.number().min(0).max(1),
  humanApprover: humanApproverSchema.optional(),
})

/**
 * Authorship block for AI-assisted commits (human + AI collaboration).
 * humanShare must be in [0.0, 1.0].
 */
export const aiAssistedAuthorshipSchema = z.object({
  kind: z.literal('ai-assisted'),
  /** Fraction of code attributable to the human collaborator. */
  humanShare: z.number().min(0).max(1),
  humanApprover: humanApproverSchema.optional(),
})

/**
 * Authorship block for fully autonomous AI commits.
 * humanShare is null because no human contributed.
 */
export const aiAutonomousAuthorshipSchema = z.object({
  kind: z.literal('ai-autonomous'),
  /** Always null for autonomous commits -- no human contribution. */
  humanShare: z.null(),
  humanApprover: humanApproverSchema.optional(),
})

/**
 * Discriminated union across the three authorship kinds.
 * Determines which fields are required downstream (agent, execution).
 */
export const authorshipSchema = z.discriminatedUnion('kind', [
  humanAuthorshipSchema,
  aiAssistedAuthorshipSchema,
  aiAutonomousAuthorshipSchema,
])

// ---------------------------------------------------------------------------
// Full predicate (union of three kind-specific shapes)
// ---------------------------------------------------------------------------

/**
 * Human-only predicate: authorship.kind === "human".
 * Agent and execution are optional (may be absent).
 */
const humanPredicateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  authorship: humanAuthorshipSchema,
  agent: agentSchema.optional(),
  execution: executionSchema.optional(),
  scope: scopeSchema,
  policy: policySchema,
})

/**
 * AI-assisted predicate: authorship.kind === "ai-assisted".
 * Agent and execution are required.
 */
const aiAssistedPredicateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  authorship: aiAssistedAuthorshipSchema,
  agent: agentSchema,
  execution: executionSchema,
  scope: scopeSchema,
  policy: policySchema,
})

/**
 * AI-autonomous predicate: authorship.kind === "ai-autonomous".
 * Agent and execution are required.
 */
const aiAutonomousPredicateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  authorship: aiAutonomousAuthorshipSchema,
  agent: agentSchema,
  execution: executionSchema,
  scope: scopeSchema,
  policy: policySchema,
})

/**
 * The complete Pedigree predicate schema.
 *
 * Uses a Zod union of three kind-specific shapes so that:
 * - Human commits may omit `agent` and `execution`
 * - AI-assisted commits require both, with a numeric `humanShare`
 * - AI-autonomous commits require both, with `humanShare: null`
 *
 * This is the canonical TypeScript definition. The Python Pydantic model
 * in pedigree-mcp MUST mirror this structure exactly.
 */
export const predicateSchema = z.union([
  humanPredicateSchema,
  aiAssistedPredicateSchema,
  aiAutonomousPredicateSchema,
])

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

/** The authorship kind discriminator values. */
export type AuthorshipKind = (typeof AUTHORSHIP_KINDS)[number]

/** The risk classification values. */
export type RiskClass = (typeof RISK_CLASSES)[number]

/** OIDC-authenticated human approver identity. */
export type HumanApprover = z.infer<typeof humanApproverSchema>

/** AI agent metadata. */
export type Agent = z.infer<typeof agentSchema>

/** Content-addressed Skill reference. */
export type SkillHash = z.infer<typeof skillHashSchema>

/** Agent execution context. */
export type Execution = z.infer<typeof executionSchema>

/** Commit change scope. */
export type Scope = z.infer<typeof scopeSchema>

/** Policy evaluation result. */
export type Policy = z.infer<typeof policySchema>

/** Authorship discriminated union. */
export type Authorship = z.infer<typeof authorshipSchema>

/** The full Pedigree predicate payload. */
export type PedigreePredicate = z.infer<typeof predicateSchema>

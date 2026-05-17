/**
 * In-toto Statement v1 wrapper for the Pedigree predicate.
 *
 * Separates Statement construction from signing because the Statement shape
 * is a stable contract auditors read, while the signing mechanism (Sigstore
 * vs. ed25519 fallback) is swappable at runtime.
 */

import { z } from 'zod'
import { ok, err, Result } from 'neverthrow'
import { PREDICATE_TYPE_V1, STATEMENT_TYPE_V1 } from './constants'
import { predicateSchema, sha1Hash } from './predicate'
import type { PedigreePredicate } from './predicate'
import { SchemaValidationError } from './errors'

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/**
 * A single subject entry in the in-toto Statement.
 * For Pedigree, the subject is always a git commit identified by SHA-1.
 */
export const commitSubjectSchema = z.object({
  /** Fixed name identifying this as a git commit subject. */
  name: z.literal('git+commit'),
  /** The commit digest; keyed by algorithm name. */
  digest: z.object({
    /** Lowercase hex SHA-1 of the git commit. */
    sha1: sha1Hash,
  }),
})

/**
 * The full in-toto Statement v1 wrapping a Pedigree predicate.
 *
 * Validates that:
 * - `_type` matches the in-toto Statement v1 URI
 * - `predicateType` matches the Pedigree predicate type URI
 * - `subject` contains at least one commit subject
 * - `predicate` passes the full Pedigree predicate schema
 */
export const statementSchema = z.object({
  /** In-toto Statement type URI. */
  _type: z.literal(STATEMENT_TYPE_V1),
  /** At least one git commit subject. */
  subject: z.array(commitSubjectSchema).min(1),
  /** Must be the Pedigree predicate type. */
  predicateType: z.literal(PREDICATE_TYPE_V1),
  /** The Pedigree predicate payload. */
  predicate: predicateSchema,
})

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

/** A single commit subject entry in the in-toto Statement. */
export type CommitSubject = z.infer<typeof commitSubjectSchema>

/** A complete, unsigned in-toto Statement with a Pedigree predicate. */
export type InTotoStatement = z.infer<typeof statementSchema>

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds a v1.0 in-toto Statement wrapping a Pedigree predicate.
 *
 * Statement construction is separated from signing because the Statement
 * shape is a stable contract auditors read, while the signing mechanism
 * (Sigstore vs. ed25519 fallback) is swappable at runtime.
 *
 * @param commitSha - The git commit SHA-1 being attested (lowercase hex).
 * @param predicate - The validated Pedigree predicate payload.
 * @returns A Result containing either a valid InTotoStatement or a SchemaValidationError.
 */
export function buildStatement(
  commitSha: string,
  predicate: PedigreePredicate,
): Result<InTotoStatement, SchemaValidationError> {
  const raw = {
    _type: STATEMENT_TYPE_V1,
    subject: [
      {
        name: 'git+commit' as const,
        digest: { sha1: commitSha },
      },
    ],
    predicateType: PREDICATE_TYPE_V1,
    predicate,
  }

  const result = statementSchema.safeParse(raw)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    return err(new SchemaValidationError(`Statement validation failed: ${issues}`))
  }

  return ok(result.data)
}

/**
 * Parses a raw JSON object as an InTotoStatement, returning a Result.
 *
 * Use this when receiving a statement from an untrusted source (network,
 * file, MCP response) and you need to validate it before processing.
 *
 * @param raw - The raw JSON object to parse.
 * @returns A Result containing either a valid InTotoStatement or a SchemaValidationError.
 */
export function parseStatement(raw: unknown): Result<InTotoStatement, SchemaValidationError> {
  const result = statementSchema.safeParse(raw)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    return err(new SchemaValidationError(`Statement parsing failed: ${issues}`))
  }

  return ok(result.data)
}

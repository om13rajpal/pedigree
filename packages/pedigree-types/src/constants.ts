/** Canonical constants for the Pedigree predicate schema. */

/** The in-toto predicate type URI for AI authorship attestations. */
export const PREDICATE_TYPE_V1 = 'dev.pedigree/ai-authorship/v1' as const

/** The in-toto Statement type URI. */
export const STATEMENT_TYPE_V1 = 'https://in-toto.io/Statement/v1' as const

/** Valid values for authorship.kind. */
export const AUTHORSHIP_KINDS = ['human', 'ai-assisted', 'ai-autonomous'] as const

/** Valid values for scope.riskClass. */
export const RISK_CLASSES = ['low', 'medium', 'high'] as const

/** Default network timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000

/** Current schema version. */
export const SCHEMA_VERSION = '1.0.0' as const

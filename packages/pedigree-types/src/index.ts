/** Public API for pedigree-types -- the shared schema package. */

// -- Predicate schemas and types --
export {
  predicateSchema,
  authorshipSchema,
  humanAuthorshipSchema,
  aiAssistedAuthorshipSchema,
  aiAutonomousAuthorshipSchema,
  humanApproverSchema,
  agentSchema,
  skillHashSchema,
  executionSchema,
  scopeSchema,
  policySchema,
  sha1Hash,
} from './predicate'
export type {
  PedigreePredicate,
  AuthorshipKind,
  RiskClass,
  HumanApprover,
  Agent,
  SkillHash,
  Execution,
  Scope,
  Policy,
  Authorship,
} from './predicate'

// -- Statement schema, types, and builders --
export { statementSchema, commitSubjectSchema, buildStatement, parseStatement } from './statement'
export type { InTotoStatement, CommitSubject } from './statement'

// -- Constants --
export {
  PREDICATE_TYPE_V1,
  STATEMENT_TYPE_V1,
  AUTHORSHIP_KINDS,
  RISK_CLASSES,
  DEFAULT_TIMEOUT_MS,
  SCHEMA_VERSION,
} from './constants'

// -- Errors --
export {
  PedigreeError,
  SchemaValidationError,
  SigningError,
  VerificationError,
  RekorError,
  PolicyViolationError,
} from './errors'

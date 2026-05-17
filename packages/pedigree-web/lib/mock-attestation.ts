/** Mock attestation data for development before real MCP integration. */

import type { PedigreePredicate } from 'pedigree-types'
import { SCHEMA_VERSION } from 'pedigree-types'

/**
 * Metadata about the git commit itself, supplementing the predicate
 * with human-readable context for the Passport page.
 */
export interface CommitMeta {
  /** The full display name of the commit author. */
  author: string
  /** The commit author's email address. */
  email: string
  /** The first line of the commit message. */
  message: string
  /** ISO-8601 timestamp of the commit. */
  timestamp: string
  /** The first 7 characters of the commit SHA for display. */
  shortSha: string
}

/**
 * Complete attestation payload returned by the data layer.
 *
 * Combines the cryptographic predicate, Rekor transparency log metadata,
 * and human-readable commit metadata into a single object suitable for
 * rendering the Passport page.
 */
export interface AttestationData {
  /** The full git commit SHA. */
  sha: string
  /** The validated Pedigree predicate. */
  predicate: PedigreePredicate
  /** URL to the Rekor transparency log entry. */
  rekorEntryUrl: string
  /** The UUID of the Rekor log entry. */
  rekorUuid: string
  /** Human-readable commit metadata. */
  commitMeta: CommitMeta
  /** Whether the chain of custody is fully verified. */
  isVerified: boolean
}

/** Static mock Rekor entry URL for development. */
const MOCK_REKOR_URL = 'https://search.sigstore.dev/?logIndex=12345678'

/** Static mock Rekor entry UUID for development. */
const MOCK_REKOR_UUID = '24296fb24b8ad77a8b25735be1c50b6231b88e2d0c2f8e3a5693b12ff4e5c901'

/**
 * Returns a fully valid mock attestation for development and testing.
 *
 * The returned data matches the Pedigree predicate Zod schema exactly,
 * using the provided SHA for the commit subject. This function will be
 * replaced by real MCP calls in a later phase.
 *
 * @param sha - The commit SHA to include in the mock attestation.
 * @returns A complete AttestationData object with realistic mock values.
 */
export function getMockAttestation(sha: string): AttestationData {
  const predicate: PedigreePredicate = {
    schemaVersion: SCHEMA_VERSION,
    authorship: {
      kind: 'ai-assisted',
      humanShare: 0.15,
      humanApprover: {
        oidcIssuer: 'https://github.com',
        subject: 'om@agiready.io',
        approved: true,
        timestamp: '2026-05-16T14:32:11Z',
      },
    },
    agent: {
      tool: 'ibm-bob',
      toolVersion: '1.4.2',
      model: 'granite-3.3-8b-instruct',
      modelProvider: 'watsonx.ai',
    },
    execution: {
      modeSlug: 'provenance-officer',
      skillHashes: [
        {
          name: 'sign-on-commit',
          sha256: 'a3f5e2d1c4b6789012345678abcdef0123456789abcdef0123456789abcdef01',
        },
        {
          name: 'verify-chain',
          sha256: 'b7c8d9e0f1a2345678901234abcdef5678901234abcdef5678901234abcdef56',
        },
      ],
      agentsMdHash: 'sha256:9c1b3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
      promptHash: 'sha256:4f2e8d1c3b5a7f9e0d2c4b6a8f1e3d5c7b9a0f2e4d6c8b0a2f4e6d8c0b2a4f6e',
      planHash: 'sha256:7d8a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
      bobSessionId: '639be8ed-e654-4a3b-b912-7c1d8e9f0a1b',
      bobcoinsConsumed: 0.52,
    },
    scope: {
      filesTouched: ['src/auth/login.ts', 'src/auth/session.ts', 'tests/auth.test.ts'],
      linesAdded: 47,
      linesDeleted: 12,
      riskClass: 'medium',
    },
    policy: {
      agentsMdPolicy: 'v1',
      requiresHumanApproval: true,
      satisfied: true,
    },
  }

  const shortSha = sha.slice(0, 7)

  const commitMeta: CommitMeta = {
    author: 'Om Rajpal',
    email: 'om@agiready.io',
    message: 'feat(auth): add OIDC login flow with session management',
    timestamp: '2026-05-16T14:32:11Z',
    shortSha,
  }

  return {
    sha,
    predicate,
    rekorEntryUrl: MOCK_REKOR_URL,
    rekorUuid: MOCK_REKOR_UUID,
    commitMeta,
    isVerified: true,
  }
}

import type { AttestationData } from './mock-attestation'
import { verifyDSSE } from './signing'
import cachedAttestations from './cached-attestations.json'

export type { AttestationData } from './mock-attestation'
export type { CommitMeta } from './mock-attestation'

const INTERNAL_API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3003'
const FETCH_TIMEOUT_MS = 12_000

const GITHUB_OWNER = 'om13rajpal'
const GITHUB_DEMO_REPO = 'pedigree-demo'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_DEMO_REPO}`

type CachedMap = Record<string, AttestationData & { source: string }>
const CACHE = cachedAttestations as unknown as CachedMap

function ghHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/**
 * Fetches attestation data for a commit SHA.
 *
 * Resolution order:
 * 1. Live API route (pedigree-mcp CLI)
 * 2. Pre-cached attestation data
 * 3. Stored attestation from demo repo (real signed DSSE envelope)
 * 4. Not found
 */
export async function getAttestation(sha: string): Promise<AttestationData & { source: string }> {
  // 1. Try live MCP backend
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(`${INTERNAL_API_BASE}/api/attestation/${sha}`, {
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timer)

    if (response.ok) {
      const data = (await response.json()) as AttestationData & { source?: string }
      if (data.source === 'live') {
        return { ...data, source: 'live' }
      }
    }
  } catch {
    /* API unavailable */
  }

  // 2. Try pre-cached attestation data
  const cached = CACHE[sha]
  if (cached) {
    return { ...cached, source: 'cached' }
  }

  // 3. Try reading stored attestation from demo repo
  try {
    const demoData = await fetchStoredAttestation(sha)
    if (demoData) {
      return { ...demoData, source: 'live' }
    }
  } catch {
    /* demo repo lookup failed */
  }

  // 4. Not found
  return {
    sha,
    predicate: {
      schemaVersion: '1.0.0',
      authorship: { kind: 'human' as const, humanShare: 1.0 },
      scope: {
        filesTouched: ['unknown'],
        linesAdded: 0,
        linesDeleted: 0,
        riskClass: 'low' as const,
      },
      policy: { agentsMdPolicy: 'v1', requiresHumanApproval: false, satisfied: false },
    } as AttestationData['predicate'],
    rekorEntryUrl: '',
    rekorUuid: '',
    commitMeta: {
      author: 'Unknown',
      email: '',
      message: 'No attestation found for this commit',
      timestamp: new Date().toISOString(),
      shortSha: sha.slice(0, 7),
    },
    isVerified: false,
    source: 'not-found',
  }
}

/**
 * Fetch a real signed attestation stored in the demo repo,
 * then fetch commit metadata and verify the DSSE signature.
 */
async function fetchStoredAttestation(sha: string): Promise<AttestationData | null> {
  const headers = ghHeaders()

  // Fetch the stored attestation JSON
  const attRes = await fetch(`${GITHUB_API}/contents/attestations/${sha}.json`, {
    headers,
    next: { revalidate: 30 },
  })

  if (!attRes.ok) return null

  const attFile = await attRes.json()
  const content = Buffer.from(attFile.content, 'base64').toString('utf-8')
  const stored = JSON.parse(content) as {
    envelope: {
      payloadType: string
      payload: string
      signatures: Array<{ keyid: string; sig: string }>
    }
    predicate: Record<string, unknown>
    commitSha: string
    signedAt: string
    signerKeyId: string
    rekorUuid?: string | null
    rekorEntryUrl?: string | null
    rekorLogIndex?: number | null
  }

  // Verify the DSSE signature
  let isVerified = false
  try {
    isVerified = verifyDSSE(stored.envelope)
  } catch {
    // signing key may not be available on this instance
  }

  // Fetch commit metadata
  const commitRes = await fetch(`${GITHUB_API}/commits/${sha}`, {
    headers,
    next: { revalidate: 60 },
  })

  let author = 'Unknown'
  let email = ''
  let message = ''
  let timestamp = stored.signedAt

  if (commitRes.ok) {
    const commit = await commitRes.json()
    author = commit.commit?.author?.name ?? 'Unknown'
    email = commit.commit?.author?.email ?? ''
    message = commit.commit?.message ?? ''
    timestamp = commit.commit?.author?.date ?? stored.signedAt
  }

  return {
    sha,
    predicate: stored.predicate as AttestationData['predicate'],
    rekorEntryUrl: stored.rekorEntryUrl ?? '',
    rekorUuid: stored.rekorUuid ?? stored.signerKeyId,
    commitMeta: {
      author,
      email,
      message,
      timestamp,
      shortSha: sha.slice(0, 7),
    },
    isVerified,
  }
}

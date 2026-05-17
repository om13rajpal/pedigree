/** API route returning attestation data for a commit SHA.
 *
 * Tries the real pedigree-mcp CLI first (ed25519-signed attestation from
 * git refs). Falls back to mock data when the CLI is unavailable or the
 * commit has no attestation stored.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { NextResponse } from 'next/server'
import type { AttestationData } from '@/lib/mock-attestation'

const exec = promisify(execFile)

/** Absolute path to the pedigree-mcp package from the monorepo root. */
const MCP_PKG_DIR = path.resolve(process.cwd(), '..', 'pedigree-mcp')

/** Timeout for CLI subprocess calls in milliseconds. */
const CLI_TIMEOUT_MS = 15_000

interface RouteParams {
  params: Promise<{
    sha: string
  }>
}

/**
 * Calls `pedigree-mcp render <sha>` via CLI and maps the output to
 * the AttestationData shape the frontend expects.
 */
async function fetchRealAttestation(sha: string): Promise<AttestationData | null> {
  try {
    const { stdout } = await exec(
      'uv',
      [
        'run',
        '--directory',
        MCP_PKG_DIR,
        'python',
        '-m',
        'pedigree_mcp',
        'render',
        sha,
        '--skip-rekor',
      ],
      {
        timeout: CLI_TIMEOUT_MS,
        cwd: process.cwd(),
        env: { ...process.env, PEDIGREE_SIGNER: 'ed25519' },
      },
    )

    const result = JSON.parse(stdout) as {
      rendered?: boolean
      commit_sha?: string
      predicate?: Record<string, unknown>
      signer_identity?: string
      rekor_verified?: boolean
      rekor_entry_url?: string
      summary?: string
    }

    if (!result.rendered || !result.predicate) {
      return null
    }

    const commitMeta = await fetchGitMeta(sha)

    return {
      sha: result.commit_sha ?? sha,
      predicate: result.predicate as unknown as AttestationData['predicate'],
      rekorEntryUrl: result.rekor_entry_url ?? '',
      rekorUuid: result.signer_identity ?? '',
      commitMeta,
      isVerified: true,
      source: 'live' as const,
    } as AttestationData
  } catch {
    return null
  }
}

/**
 * Reads commit metadata from the local git repo.
 */
async function fetchGitMeta(sha: string): Promise<AttestationData['commitMeta']> {
  try {
    const { stdout } = await exec('git', ['log', '-1', '--format=%an|%ae|%s|%aI', sha], {
      timeout: 5000,
    })

    const parts = stdout.trim().split('|')
    if (parts.length >= 4) {
      return {
        author: parts[0] ?? 'Unknown',
        email: parts[1] ?? '',
        message: parts[2] ?? '',
        timestamp: parts[3] ?? new Date().toISOString(),
        shortSha: sha.slice(0, 7),
      }
    }
  } catch {
    /* git not available or commit not found */
  }

  return {
    author: 'Unknown',
    email: '',
    message: '',
    timestamp: new Date().toISOString(),
    shortSha: sha.slice(0, 7),
  }
}

/**
 * GET /api/attestation/[sha]
 *
 * Tries live attestation from pedigree-mcp CLI.
 * Returns 404 if commit has no attestation.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { sha } = await params

  if (!sha || sha.length < 7) {
    return NextResponse.json(
      { error: 'A valid commit SHA (at least 7 characters) is required' },
      { status: 400 },
    )
  }

  const realData = await fetchRealAttestation(sha)
  if (realData) {
    return NextResponse.json({ ...realData, source: 'live' })
  }

  return NextResponse.json(
    { error: `No attestation found for commit ${sha.slice(0, 7)}` },
    { status: 404 },
  )
}

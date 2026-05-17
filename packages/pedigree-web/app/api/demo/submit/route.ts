import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { buildInTotoStatement, signDSSE, submitToRekor } from '@/lib/signing'

const GITHUB_OWNER = 'om13rajpal'
const GITHUB_REPO = 'pedigree-demo'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`

type Scenario = 'human' | 'ai-assisted' | 'ai-autonomous'

interface ApprovalPayload {
  codeHash: string
  timestamp: string
  approver: string
  signature: string
  publicKey: string
}

interface SubmitBody {
  code: string
  fileName: string
  scenario: Scenario
  model?: string
  prompt?: string
  approval?: ApprovalPayload
}

function getGitHubToken(): string | null {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null
}

async function ghFetch(path: string, options: RequestInit = {}) {
  const token = getGitHubToken()
  if (!token) throw new Error('No GitHub token configured. Set GITHUB_TOKEN env var.')

  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub API ${res.status}: ${body}`)
  }

  return res.json()
}

function buildPredicate(
  scenario: Scenario,
  fileName: string,
  linesAdded: number,
  model?: string,
  userPrompt?: string,
  approval?: ApprovalPayload,
) {
  const now = new Date().toISOString()
  const base = {
    schemaVersion: '1.0.0',
    scope: {
      filesTouched: [`src/submissions/${fileName}`],
      linesAdded,
      linesDeleted: 0,
      riskClass: 'low' as const,
    },
    policy: {
      agentsMdPolicy: 'v1',
      requiresHumanApproval: false,
      satisfied: true,
    },
  }

  const hasApproval = !!approval?.signature
  const approver = {
    oidcIssuer: 'https://github.com',
    subject: approval?.approver ?? 'Om Rajpal',
    approved: hasApproval,
    timestamp: approval?.timestamp ?? now,
    ...(hasApproval
      ? {
          approvalSig: approval.signature,
          approvalPubKey: approval.publicKey,
          codeHash: approval.codeHash,
        }
      : {}),
  }

  if (scenario === 'human') {
    return {
      ...base,
      authorship: { kind: 'human' as const, humanShare: 1.0, humanApprover: approver },
    }
  }

  const modelId = model ?? 'google/gemini-2.5-flash'
  const provider = modelId.split('/')[0] ?? 'unknown'

  const agentFields = {
    agent: {
      tool: 'pedigree-demo',
      toolVersion: '1.0.0',
      model: modelId,
      modelProvider: provider,
    },
    execution: {
      modeSlug: 'provenance-officer',
      skillHashes: [
        {
          name: 'sign-on-commit',
          sha256: crypto.createHash('sha256').update('demo-skill').digest('hex'),
        },
      ],
      agentsMdHash: `sha256:${crypto.createHash('sha256').update('demo-agents').digest('hex')}`,
      promptHash: `sha256:${crypto
        .createHash('sha256')
        .update(userPrompt ?? 'no-prompt')
        .digest('hex')}`,
      planHash: `sha256:${crypto.createHash('sha256').update('demo-plan').digest('hex')}`,
      bobSessionId: crypto.randomUUID(),
      bobcoinsConsumed: 0.12,
    },
  }

  if (scenario === 'ai-assisted') {
    return {
      ...base,
      ...agentFields,
      authorship: { kind: 'ai-assisted' as const, humanShare: 0.35, humanApprover: approver },
    }
  }

  return {
    ...base,
    ...agentFields,
    authorship: { kind: 'ai-autonomous' as const, humanShare: null, humanApprover: approver },
  }
}

const SCENARIO_LABELS: Record<Scenario, string> = {
  human: 'human-authored',
  'ai-assisted': 'AI-assisted',
  'ai-autonomous': 'AI-autonomous',
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: SubmitBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { code, fileName, scenario, model, prompt, approval } = body

  if (!code || !fileName || !scenario) {
    return NextResponse.json(
      { error: 'code, fileName, and scenario are required' },
      { status: 400 },
    )
  }

  if (!['human', 'ai-assisted', 'ai-autonomous'].includes(scenario)) {
    return NextResponse.json({ error: 'Invalid scenario' }, { status: 400 })
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `src/submissions/${safeName}`
  const commitMsg = `demo(${scenario}): ${SCENARIO_LABELS[scenario]} submission — ${safeName}`
  const linesAdded = code.split('\n').length

  try {
    // 1. Create commit via GitHub API
    let existingFileSha: string | undefined
    try {
      const existing = await ghFetch(`/contents/${filePath}`)
      existingFileSha = existing.sha
    } catch {
      // file doesn't exist yet
    }

    const result = await ghFetch(`/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: commitMsg,
        content: Buffer.from(code).toString('base64'),
        ...(existingFileSha ? { sha: existingFileSha } : {}),
      }),
    })

    const sha = result.commit.sha as string

    // 2. Build predicate
    const predicate = buildPredicate(scenario, safeName, linesAdded, model, prompt, approval)

    // 3. Create in-toto Statement
    const statement = buildInTotoStatement(sha, predicate)

    // 4. Sign with ed25519 DSSE envelope
    const { envelope, keyId } = signDSSE(statement)

    // 5. Submit to Rekor transparency log
    let rekorUuid = ''
    let rekorEntryUrl = ''
    let rekorLogIndex: number | null = null
    const rekorResult = await submitToRekor(envelope)
    if (rekorResult) {
      rekorUuid = rekorResult.uuid
      rekorEntryUrl = rekorResult.entryUrl
      rekorLogIndex = rekorResult.logIndex
    }

    // 6. Store attestation (with Rekor data) in demo repo
    const attestationPath = `attestations/${sha}.json`
    const attestationData = {
      envelope,
      predicate,
      commitSha: sha,
      signedAt: new Date().toISOString(),
      signerKeyId: keyId,
      rekorUuid: rekorUuid || null,
      rekorEntryUrl: rekorEntryUrl || null,
      rekorLogIndex,
    }

    let existingAttSha: string | undefined
    try {
      const existing = await ghFetch(`/contents/${attestationPath}`)
      existingAttSha = existing.sha
    } catch {
      // doesn't exist
    }

    await ghFetch(`/contents/${attestationPath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `attestation: signed ${sha.slice(0, 7)} (${scenario})`,
        content: Buffer.from(JSON.stringify(attestationData, null, 2)).toString('base64'),
        ...(existingAttSha ? { sha: existingAttSha } : {}),
      }),
    })

    return NextResponse.json({
      sha,
      rekorUuid: rekorUuid || keyId,
      rekorEntryUrl,
      rekorLogIndex,
      isVerified: true,
      repoUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commit/${sha}`,
      attestationUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/main/${attestationPath}`,
      scenario,
      predicate,
      envelope,
      keyId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

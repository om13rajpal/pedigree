/** Tests for the Pedigree predicate sub-schemas and discriminated union. */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  predicateSchema,
  authorshipSchema,
  scopeSchema,
  policySchema,
  agentSchema,
  executionSchema,
  humanApproverSchema,
} from '../src/predicate'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Loads a JSON fixture by filename. */
function loadFixture(name: string): unknown {
  const path = resolve(__dirname, 'fixtures', name)
  return JSON.parse(readFileSync(path, 'utf-8'))
}

/** Extracts the predicate portion from a full statement fixture. */
function loadPredicate(name: string): unknown {
  const statement = loadFixture(name) as Record<string, unknown>
  return statement['predicate']
}

// ---------------------------------------------------------------------------
// Discriminated union on authorship.kind
// ---------------------------------------------------------------------------

describe('authorshipSchema - discriminated union', () => {
  it('accepts human authorship', () => {
    const result = authorshipSchema.safeParse({
      kind: 'human',
      humanShare: 1.0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts ai-assisted authorship with approver', () => {
    const result = authorshipSchema.safeParse({
      kind: 'ai-assisted',
      humanShare: 0.3,
      humanApprover: {
        oidcIssuer: 'https://github.com/login/oauth',
        subject: 'dev@example.com',
        approved: true,
        timestamp: '2026-05-16T10:00:00Z',
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts ai-autonomous with null humanShare', () => {
    const result = authorshipSchema.safeParse({
      kind: 'ai-autonomous',
      humanShare: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects ai-autonomous with numeric humanShare', () => {
    const result = authorshipSchema.safeParse({
      kind: 'ai-autonomous',
      humanShare: 0.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects ai-assisted with null humanShare', () => {
    const result = authorshipSchema.safeParse({
      kind: 'ai-assisted',
      humanShare: null,
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown kind', () => {
    const result = authorshipSchema.safeParse({
      kind: 'cyborg',
      humanShare: 0.5,
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// humanShare boundary tests
// ---------------------------------------------------------------------------

describe('humanShare boundaries', () => {
  it('accepts humanShare = 0 (all AI)', () => {
    const result = authorshipSchema.safeParse({
      kind: 'ai-assisted',
      humanShare: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts humanShare = 1 (all human in ai-assisted flow)', () => {
    const result = authorshipSchema.safeParse({
      kind: 'ai-assisted',
      humanShare: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects humanShare > 1', () => {
    const result = authorshipSchema.safeParse({
      kind: 'ai-assisted',
      humanShare: 1.01,
    })
    expect(result.success).toBe(false)
  })

  it('rejects humanShare < 0', () => {
    const result = authorshipSchema.safeParse({
      kind: 'ai-assisted',
      humanShare: -0.1,
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SHA format validation
// ---------------------------------------------------------------------------

describe('SHA format validation', () => {
  it('rejects sha256-prefixed hash without "sha256:" prefix', () => {
    const result = executionSchema.safeParse({
      modeSlug: 'provenance-officer',
      skillHashes: [{ name: 'test', sha256: 'abcdef' }],
      agentsMdHash: 'abcdef1234',
      promptHash: 'sha256:abcdef1234',
      planHash: 'sha256:abcdef1234',
      bobSessionId: '639be8ed-e654-4a1b-9c3d-5e7f9a1b3c5d',
      bobcoinsConsumed: 0,
    })
    expect(result.success).toBe(false)
  })

  it('accepts correctly formatted sha256-prefixed hashes', () => {
    const result = executionSchema.safeParse({
      modeSlug: 'provenance-officer',
      skillHashes: [{ name: 'test', sha256: 'abcdef1234' }],
      agentsMdHash: 'sha256:abcdef1234',
      promptHash: 'sha256:abcdef1234',
      planHash: 'sha256:abcdef1234',
      bobSessionId: '639be8ed-e654-4a1b-9c3d-5e7f9a1b3c5d',
      bobcoinsConsumed: 0.5,
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Scope and policy sub-schemas
// ---------------------------------------------------------------------------

describe('scopeSchema', () => {
  it('accepts valid scope', () => {
    const result = scopeSchema.safeParse({
      filesTouched: ['src/index.ts'],
      linesAdded: 10,
      linesDeleted: 0,
      riskClass: 'low',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid riskClass', () => {
    const result = scopeSchema.safeParse({
      filesTouched: ['src/index.ts'],
      linesAdded: 10,
      linesDeleted: 0,
      riskClass: 'critical',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty filesTouched', () => {
    const result = scopeSchema.safeParse({
      filesTouched: [],
      linesAdded: 0,
      linesDeleted: 0,
      riskClass: 'low',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative linesAdded', () => {
    const result = scopeSchema.safeParse({
      filesTouched: ['src/index.ts'],
      linesAdded: -1,
      linesDeleted: 0,
      riskClass: 'low',
    })
    expect(result.success).toBe(false)
  })
})

describe('policySchema', () => {
  it('accepts policy with satisfied=true', () => {
    const result = policySchema.safeParse({
      agentsMdPolicy: 'v1',
      requiresHumanApproval: false,
      satisfied: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts policy with satisfied=false (schema-valid)', () => {
    const result = policySchema.safeParse({
      agentsMdPolicy: 'v1',
      requiresHumanApproval: true,
      satisfied: false,
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Agent sub-schema edge cases
// ---------------------------------------------------------------------------

describe('agentSchema', () => {
  it('accepts valid agent', () => {
    const result = agentSchema.safeParse({
      tool: 'ibm-bob',
      toolVersion: '1.4.2',
      model: 'granite-3.3-8b-instruct',
      modelProvider: 'watsonx.ai',
    })
    expect(result.success).toBe(true)
  })

  it('rejects agent with empty tool name', () => {
    const result = agentSchema.safeParse({
      tool: '',
      toolVersion: '1.0.0',
      model: 'some-model',
      modelProvider: 'some-provider',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Human approver sub-schema
// ---------------------------------------------------------------------------

describe('humanApproverSchema', () => {
  it('accepts valid approver', () => {
    const result = humanApproverSchema.safeParse({
      oidcIssuer: 'https://github.com/login/oauth',
      subject: 'dev@example.com',
      approved: true,
      timestamp: '2026-05-16T14:32:11Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-URL oidcIssuer', () => {
    const result = humanApproverSchema.safeParse({
      oidcIssuer: 'not-a-url',
      subject: 'dev@example.com',
      approved: true,
      timestamp: '2026-05-16T14:32:11Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-datetime timestamp', () => {
    const result = humanApproverSchema.safeParse({
      oidcIssuer: 'https://github.com/login/oauth',
      subject: 'dev@example.com',
      approved: true,
      timestamp: 'last tuesday',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Predicate-level integration: human without agent/execution
// ---------------------------------------------------------------------------

describe('predicateSchema - kind-specific validation', () => {
  it('accepts human predicate without agent and execution', () => {
    const result = predicateSchema.safeParse({
      schemaVersion: '1.0.0',
      authorship: { kind: 'human', humanShare: 1.0 },
      scope: {
        filesTouched: ['README.md'],
        linesAdded: 5,
        linesDeleted: 0,
        riskClass: 'low',
      },
      policy: {
        agentsMdPolicy: 'v1',
        requiresHumanApproval: false,
        satisfied: true,
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects ai-assisted predicate without agent', () => {
    const result = predicateSchema.safeParse({
      schemaVersion: '1.0.0',
      authorship: { kind: 'ai-assisted', humanShare: 0.5 },
      scope: {
        filesTouched: ['src/index.ts'],
        linesAdded: 10,
        linesDeleted: 2,
        riskClass: 'low',
      },
      policy: {
        agentsMdPolicy: 'v1',
        requiresHumanApproval: false,
        satisfied: true,
      },
    })
    expect(result.success).toBe(false)
  })

  it('parses valid ai-assisted predicate from fixture', () => {
    const predicate = loadPredicate('valid-ai-assisted.json')
    const result = predicateSchema.safeParse(predicate)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.authorship.kind).toBe('ai-assisted')
    }
  })

  it('parses valid human predicate from fixture', () => {
    const predicate = loadPredicate('valid-human.json')
    const result = predicateSchema.safeParse(predicate)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.authorship.kind).toBe('human')
    }
  })

  it('parses valid ai-autonomous predicate from fixture', () => {
    const predicate = loadPredicate('valid-ai-autonomous.json')
    const result = predicateSchema.safeParse(predicate)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.authorship.kind).toBe('ai-autonomous')
      expect(result.data.authorship.humanShare).toBeNull()
    }
  })

  it('rejects predicate with missing authorship.kind', () => {
    const predicate = loadPredicate('invalid-missing-kind.json')
    const result = predicateSchema.safeParse(predicate)
    expect(result.success).toBe(false)
  })

  it('rejects predicate with invalid riskClass', () => {
    const predicate = loadPredicate('invalid-bad-risk-class.json')
    const result = predicateSchema.safeParse(predicate)
    expect(result.success).toBe(false)
  })

  it('accepts predicate with policy.satisfied=false (schema-valid)', () => {
    const predicate = loadPredicate('invalid-policy-unsatisfied.json')
    const result = predicateSchema.safeParse(predicate)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.policy.satisfied).toBe(false)
    }
  })
})

/** Tests for the in-toto Statement schema, builder, and parser. */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { predicateSchema } from '../src/predicate'
import { statementSchema, buildStatement, parseStatement } from '../src/statement'

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
// statementSchema - valid fixtures
// ---------------------------------------------------------------------------

describe('statementSchema - valid fixtures', () => {
  it('parses a valid ai-assisted statement', () => {
    const raw = loadFixture('valid-ai-assisted.json')
    const result = statementSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.predicate.authorship.kind).toBe('ai-assisted')
      expect(result.data.subject[0]?.name).toBe('git+commit')
    }
  })

  it('parses a valid human-only statement', () => {
    const raw = loadFixture('valid-human.json')
    const result = statementSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.predicate.authorship.kind).toBe('human')
    }
  })

  it('parses a valid ai-autonomous statement', () => {
    const raw = loadFixture('valid-ai-autonomous.json')
    const result = statementSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.predicate.authorship.kind).toBe('ai-autonomous')
      expect(result.data.predicate.authorship.humanShare).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// statementSchema - invalid fixtures
// ---------------------------------------------------------------------------

describe('statementSchema - invalid fixtures', () => {
  it('rejects a statement with missing authorship.kind', () => {
    const raw = loadFixture('invalid-missing-kind.json')
    const result = statementSchema.safeParse(raw)
    expect(result.success).toBe(false)
  })

  it('rejects a statement with invalid riskClass', () => {
    const raw = loadFixture('invalid-bad-risk-class.json')
    const result = statementSchema.safeParse(raw)
    expect(result.success).toBe(false)
  })

  it('accepts a statement with policy.satisfied=false (schema-valid)', () => {
    const raw = loadFixture('invalid-policy-unsatisfied.json')
    const result = statementSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.predicate.policy.satisfied).toBe(false)
    }
  })

  it('rejects uppercase hex in commit SHA-1', () => {
    const raw = loadFixture('valid-ai-assisted.json') as Record<string, unknown>
    const modified = {
      ...raw,
      subject: [{ name: 'git+commit', digest: { sha1: 'A1B2C3D4' } }],
    }
    const result = statementSchema.safeParse(modified)
    expect(result.success).toBe(false)
  })

  it('rejects wrong predicateType', () => {
    const raw = loadFixture('valid-ai-assisted.json') as Record<string, unknown>
    const modified = { ...raw, predicateType: 'wrong/type/v1' }
    const result = statementSchema.safeParse(modified)
    expect(result.success).toBe(false)
  })

  it('rejects wrong _type', () => {
    const raw = loadFixture('valid-ai-assisted.json') as Record<string, unknown>
    const modified = { ...raw, _type: 'https://wrong.io/Statement/v2' }
    const result = statementSchema.safeParse(modified)
    expect(result.success).toBe(false)
  })

  it('rejects empty subject array', () => {
    const raw = loadFixture('valid-ai-assisted.json') as Record<string, unknown>
    const modified = { ...raw, subject: [] }
    const result = statementSchema.safeParse(modified)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildStatement
// ---------------------------------------------------------------------------

describe('buildStatement', () => {
  it('builds a valid statement from an ai-assisted predicate', () => {
    const predicate = loadPredicate('valid-ai-assisted.json')
    const parsed = predicateSchema.parse(predicate)
    const result = buildStatement('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', parsed)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value._type).toBe('https://in-toto.io/Statement/v1')
      expect(result.value.predicateType).toBe('dev.pedigree/ai-authorship/v1')
      expect(result.value.subject).toHaveLength(1)
    }
  })

  it('builds a valid statement from a human predicate', () => {
    const predicate = loadPredicate('valid-human.json')
    const parsed = predicateSchema.parse(predicate)
    const result = buildStatement('b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', parsed)
    expect(result.isOk()).toBe(true)
  })

  it('returns error for invalid commit SHA (uppercase)', () => {
    const predicate = loadPredicate('valid-ai-assisted.json')
    const parsed = predicateSchema.parse(predicate)
    const result = buildStatement('INVALID_SHA', parsed)
    expect(result.isErr()).toBe(true)
  })

  it('returns error for empty commit SHA', () => {
    const predicate = loadPredicate('valid-ai-assisted.json')
    const parsed = predicateSchema.parse(predicate)
    const result = buildStatement('', parsed)
    expect(result.isErr()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// parseStatement
// ---------------------------------------------------------------------------

describe('parseStatement', () => {
  it('parses a valid ai-assisted fixture', () => {
    const raw = loadFixture('valid-ai-assisted.json')
    const result = parseStatement(raw)
    expect(result.isOk()).toBe(true)
  })

  it('parses a valid human fixture', () => {
    const raw = loadFixture('valid-human.json')
    const result = parseStatement(raw)
    expect(result.isOk()).toBe(true)
  })

  it('parses a valid ai-autonomous fixture', () => {
    const raw = loadFixture('valid-ai-autonomous.json')
    const result = parseStatement(raw)
    expect(result.isOk()).toBe(true)
  })

  it('returns error for garbage input', () => {
    const result = parseStatement({ garbage: true })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.name).toBe('SchemaValidationError')
    }
  })

  it('returns error for null input', () => {
    const result = parseStatement(null)
    expect(result.isErr()).toBe(true)
  })

  it('returns error for undefined input', () => {
    const result = parseStatement(undefined)
    expect(result.isErr()).toBe(true)
  })
})

/**
 * Unit tests for summary generation modules.
 *
 * Tests the watsonx.ai client, template generator, cache, and prompt builder
 * with mocked dependencies and fixtures.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WatsonxClient, WatsonxError } from '@/lib/watsonx-client'
import { generateTemplateSummary, generateShortSummary } from '@/lib/template-summary'
import { InMemorySummaryCache } from '@/lib/summary-cache'
import { buildPrompt, extractPredicateFields } from '@/lib/prompt-builder'
import type { PedigreePredicate } from 'pedigree-types'
import type { CommitMeta } from '@/lib/mock-attestation'

// Mock fetch globally
global.fetch = vi.fn()

describe('WatsonxClient', () => {
  const mockConfig = {
    apiKey: 'test-api-key',
    projectId: 'test-project-id',
    baseUrl: 'https://test.watsonx.ai',
    timeout: 5000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates text successfully', async () => {
    const mockResponse = {
      results: [{ generated_text: 'This is a test summary.' }],
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const client = new WatsonxClient(mockConfig)
    const result = await client.generateText('Test prompt')

    expect(result).toBe('This is a test summary.')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ml/v1/text/generation'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      }),
    )
  })

  it('handles timeout errors', async () => {
    ;(global.fetch as any).mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AbortError')), 100)
      })
    })

    const client = new WatsonxClient({ ...mockConfig, timeout: 50 })
    const promise = client.generateText('Test prompt')

    await expect(promise).rejects.toThrow(WatsonxError)
  })

  it('handles authentication errors', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })

    const client = new WatsonxClient(mockConfig)
    const promise = client.generateText('Test prompt')

    await expect(promise).rejects.toThrow(WatsonxError)
  })

  it('handles rate limit errors', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limit exceeded' }),
    })

    const client = new WatsonxClient(mockConfig)
    const promise = client.generateText('Test prompt')

    await expect(promise).rejects.toThrow(WatsonxError)
  })

  it('retries on server errors', async () => {
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ generated_text: 'Success after retry' }] }),
      })

    const client = new WatsonxClient(mockConfig)
    const result = await client.generateText('Test prompt')

    expect(result).toBe('Success after retry')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('performs health check', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
    })

    const client = new WatsonxClient(mockConfig)
    const healthy = await client.healthCheck()

    expect(healthy).toBe(true)
  })
})

describe('Template Summary Generator', () => {
  const mockCommitMeta: CommitMeta = {
    author: 'Test User',
    email: 'test@example.com',
    message: 'Test commit',
    timestamp: '2026-05-16T14:32:11Z',
    shortSha: 'abc123d',
  }

  it('generates summary for human commit', () => {
    const predicate: PedigreePredicate = {
      schemaVersion: '1.0.0',
      authorship: {
        kind: 'human',
        humanShare: 1.0,
      },
      scope: {
        filesTouched: ['src/app.ts'],
        linesAdded: 10,
        linesDeleted: 2,
        riskClass: 'low',
      },
      policy: {
        agentsMdPolicy: 'v1',
        requiresHumanApproval: false,
        satisfied: true,
      },
    }

    const summary = generateTemplateSummary(predicate, mockCommitMeta)

    expect(summary).toContain('written entirely by a human')
    expect(summary).toContain('1 low-risk file')
    expect(summary).toContain('No human approval was required')
  })

  it('generates summary for AI-assisted commit', () => {
    const predicate: PedigreePredicate = {
      schemaVersion: '1.0.0',
      authorship: {
        kind: 'ai-assisted',
        humanShare: 0.15,
        humanApprover: {
          oidcIssuer: 'https://github.com/login/oauth',
          subject: 'test@example.com',
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
        skillHashes: [{ name: 'sign-on-commit', sha256: 'abc123' }],
        agentsMdHash: 'sha256:def456',
        promptHash: 'sha256:ghi789',
        planHash: 'sha256:jkl012',
        bobSessionId: '123e4567-e89b-12d3-a456-426614174000',
        bobcoinsConsumed: 0.52,
      },
      scope: {
        filesTouched: ['src/auth/login.ts', 'src/auth/session.ts'],
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

    const summary = generateTemplateSummary(predicate, mockCommitMeta)

    expect(summary).toContain('AI-assisted development')
    expect(summary).toContain('15% human contribution')
    expect(summary).toContain('ibm-bob')
    expect(summary).toContain('granite-3.3-8b-instruct')
    expect(summary).toContain('2 medium-risk files')
    expect(summary).toContain('approval was required and granted')
  })

  it('generates summary for AI-autonomous commit', () => {
    const predicate: PedigreePredicate = {
      schemaVersion: '1.0.0',
      authorship: {
        kind: 'ai-autonomous',
        humanShare: null,
      },
      agent: {
        tool: 'cursor',
        toolVersion: '1.2.0',
        model: 'gpt-4o',
        modelProvider: 'openai',
      },
      execution: {
        modeSlug: 'default',
        skillHashes: [],
        agentsMdHash: 'sha256:abc123',
        promptHash: 'sha256:def456',
        planHash: 'sha256:ghi789',
        bobSessionId: '123e4567-e89b-12d3-a456-426614174000',
        bobcoinsConsumed: 0.0,
      },
      scope: {
        filesTouched: ['tests/test_utils.py'],
        linesAdded: 23,
        linesDeleted: 0,
        riskClass: 'low',
      },
      policy: {
        agentsMdPolicy: 'v1',
        requiresHumanApproval: false,
        satisfied: true,
      },
    }

    const summary = generateTemplateSummary(predicate, mockCommitMeta)

    expect(summary).toContain('generated autonomously')
    expect(summary).toContain('cursor')
    expect(summary).toContain('gpt-4o')
    expect(summary).toContain('No human approval was required')
  })

  it('generates short summary', () => {
    const predicate: PedigreePredicate = {
      schemaVersion: '1.0.0',
      authorship: {
        kind: 'ai-assisted',
        humanShare: 0.15,
      },
      agent: {
        tool: 'ibm-bob',
        toolVersion: '1.4.2',
        model: 'granite-3.3-8b-instruct',
        modelProvider: 'watsonx.ai',
      },
      execution: {
        modeSlug: 'provenance-officer',
        skillHashes: [{ name: 'sign-on-commit', sha256: 'abc123' }],
        agentsMdHash: 'sha256:def456',
        promptHash: 'sha256:ghi789',
        planHash: 'sha256:jkl012',
        bobSessionId: '123e4567-e89b-12d3-a456-426614174000',
        bobcoinsConsumed: 0.52,
      },
      scope: {
        filesTouched: ['src/app.ts'],
        linesAdded: 10,
        linesDeleted: 2,
        riskClass: 'medium',
      },
      policy: {
        agentsMdPolicy: 'v1',
        requiresHumanApproval: true,
        satisfied: true,
      },
    }

    const short = generateShortSummary(predicate)

    expect(short).toContain('AI-assisted')
    expect(short).toContain('ibm-bob')
    expect(short).toContain('1 file')
    expect(short).toContain('medium risk')
  })
})

describe('Summary Cache', () => {
  let cache: InMemorySummaryCache

  beforeEach(() => {
    cache = new InMemorySummaryCache()
  })

  it('returns null for cache miss', async () => {
    const result = await cache.get('nonexistent')
    expect(result).toBeNull()
  })

  it('stores and retrieves summaries', async () => {
    await cache.set('abc123', 'Test summary', 'watsonx')
    const result = await cache.get('abc123')

    expect(result).toBe('Test summary')
  })

  it('tracks cache statistics', async () => {
    await cache.get('miss1')
    await cache.set('hit1', 'Summary 1', 'watsonx')
    await cache.get('hit1')
    await cache.get('miss2')

    const stats = await cache.stats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(2)
  })

  it('checks if key exists', async () => {
    await cache.set('exists', 'Summary', 'template')

    expect(await cache.has('exists')).toBe(true)
    expect(await cache.has('notexists')).toBe(false)
  })

  it('clears all entries', async () => {
    await cache.set('key1', 'Summary 1', 'watsonx')
    await cache.set('key2', 'Summary 2', 'template')

    cache.clear()

    expect(cache.size()).toBe(0)
    expect(await cache.get('key1')).toBeNull()
  })
})

describe('Prompt Builder', () => {
  const mockCommitMeta: CommitMeta = {
    author: 'Test User',
    email: 'test@example.com',
    message: 'Test commit',
    timestamp: '2026-05-16T14:32:11Z',
    shortSha: 'abc123d',
  }

  it('builds prompt for AI-assisted commit', () => {
    const predicate: PedigreePredicate = {
      schemaVersion: '1.0.0',
      authorship: {
        kind: 'ai-assisted',
        humanShare: 0.15,
        humanApprover: {
          oidcIssuer: 'https://github.com/login/oauth',
          subject: 'test@example.com',
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
        skillHashes: [{ name: 'sign-on-commit', sha256: 'abc123' }],
        agentsMdHash: 'sha256:def456',
        promptHash: 'sha256:ghi789',
        planHash: 'sha256:jkl012',
        bobSessionId: '123e4567-e89b-12d3-a456-426614174000',
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

    const prompt = buildPrompt(predicate, mockCommitMeta)

    expect(prompt).toContain('technical documentation assistant')
    expect(prompt).toContain('Authorship: ai-assisted')
    expect(prompt).toContain('Human Contribution: 15%')
    expect(prompt).toContain('test@example.com (approved: true)')
    expect(prompt).toContain('ibm-bob v1.4.2')
    expect(prompt).toContain('granite-3.3-8b-instruct (watsonx.ai)')
    expect(prompt).toContain('3 files')
    expect(prompt).toContain('Risk Class: medium')
    expect(prompt).toContain('Policy Satisfied: true')
  })

  it('extracts predicate fields for logging', () => {
    const predicate: PedigreePredicate = {
      schemaVersion: '1.0.0',
      authorship: {
        kind: 'ai-autonomous',
        humanShare: null,
      },
      agent: {
        tool: 'cursor',
        toolVersion: '1.2.0',
        model: 'gpt-4o',
        modelProvider: 'openai',
      },
      execution: {
        modeSlug: 'default',
        skillHashes: [],
        agentsMdHash: 'sha256:abc123',
        promptHash: 'sha256:def456',
        planHash: 'sha256:ghi789',
        bobSessionId: '123e4567-e89b-12d3-a456-426614174000',
        bobcoinsConsumed: 0.0,
      },
      scope: {
        filesTouched: ['tests/test_utils.py'],
        linesAdded: 23,
        linesDeleted: 0,
        riskClass: 'low',
      },
      policy: {
        agentsMdPolicy: 'v1',
        requiresHumanApproval: false,
        satisfied: true,
      },
    }

    const fields = extractPredicateFields(predicate)

    expect(fields).toEqual({
      authorshipKind: 'ai-autonomous',
      humanShare: null,
      approved: null,
      agentTool: 'cursor',
      agentModel: 'gpt-4o',
      fileCount: 1,
      linesAdded: 23,
      linesDeleted: 0,
      riskClass: 'low',
      policySatisfied: true,
      requiresApproval: false,
    })
  })
})

// Made with Bob

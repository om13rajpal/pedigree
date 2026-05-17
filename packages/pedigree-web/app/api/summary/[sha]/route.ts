/**
 * API route returning a natural-language summary of a commit attestation.
 *
 * This route implements a cache-first strategy with watsonx.ai generation
 * and template fallback. The flow is:
 * 1. Check cache for existing summary
 * 2. If miss, fetch attestation data
 * 3. Try watsonx.ai generation (Granite 3.3 8B Instruct)
 * 4. Fall back to template if watsonx.ai fails
 * 5. Cache the result and return
 */

import { NextResponse } from 'next/server'
import { getAttestation } from '@/lib/attestation'
import { createWatsonxClient, WatsonxError } from '@/lib/watsonx-client'
import { createSummaryCache } from '@/lib/summary-cache'
import { generateTemplateSummary } from '@/lib/template-summary'
import { buildPrompt, extractPredicateFields } from '@/lib/prompt-builder'
import { logger } from '@/lib/logger'

/** Dynamic route parameters for the summary API. */
interface RouteParams {
  params: Promise<{
    /** The git commit SHA to summarise. */
    sha: string
  }>
}

/** Singleton cache instance (reused across requests). */
const summaryCache = createSummaryCache()

/** Singleton watsonx.ai client (null if not configured). */
const watsonxClient = createWatsonxClient()

/**
 * Returns a human-readable summary of a commit's attestation.
 *
 * Uses watsonx.ai Granite 3.3 8B Instruct when available, with graceful
 * fallback to template-based summaries. Results are cached indefinitely
 * since predicates are immutable per SHA.
 *
 * @param _request - The incoming request (unused).
 * @param params - The dynamic route params containing the commit SHA.
 * @returns A JSON response with summary, cache status, and source.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { sha } = await params
  const startTime = Date.now()

  // Validate SHA format
  if (!sha || sha.length < 7) {
    return NextResponse.json(
      { error: 'A valid commit SHA (at least 7 characters) is required' },
      { status: 400 },
    )
  }

  try {
    // Step 1: Check cache first
    const cached = await summaryCache.get(sha)
    if (cached) {
      const latency = Date.now() - startTime
      logger.info('Cache hit', { sha: sha.slice(0, 7), latencyMs: latency })

      return NextResponse.json({
        sha,
        summary: cached,
        cached: true,
        latencyMs: latency,
      })
    }

    // Step 2: Fetch attestation data
    const attestation = await getAttestation(sha)
    const { predicate, commitMeta } = attestation

    // Step 3: Try watsonx.ai generation
    let summary: string
    let source: 'watsonx' | 'template'

    if (watsonxClient && process.env.ENABLE_WATSONX_SUMMARIES !== 'false') {
      try {
        const prompt = buildPrompt(predicate, commitMeta)
        summary = await watsonxClient.generateText(prompt)
        source = 'watsonx'

        const latency = Date.now() - startTime
        logger.info('Generated summary via watsonx.ai', {
          sha: sha.slice(0, 7),
          latencyMs: latency,
          fields: extractPredicateFields(predicate),
        })
      } catch (error) {
        // Step 4: Fall back to template on watsonx.ai failure
        const errorCode = error instanceof WatsonxError ? error.code : 'UNKNOWN'
        logger.warn('watsonx.ai failed, using template fallback', {
          sha: sha.slice(0, 7),
          error: (error as Error).message,
          errorCode,
        })

        summary = generateTemplateSummary(predicate, commitMeta)
        source = 'template'
      }
    } else {
      // watsonx.ai not configured or disabled
      summary = generateTemplateSummary(predicate, commitMeta)
      source = 'template'

      if (!watsonxClient) {
        logger.info('watsonx.ai not configured, using template', {
          sha: sha.slice(0, 7),
        })
      }
    }

    // Step 5: Cache the result
    if (process.env.ENABLE_SUMMARY_CACHE !== 'false') {
      await summaryCache.set(sha, summary, source)
    }

    const latency = Date.now() - startTime

    return NextResponse.json({
      sha,
      summary,
      cached: false,
      source,
      latencyMs: latency,
    })
  } catch (error) {
    logger.error('Summary generation failed', {
      sha: sha.slice(0, 7),
      error: (error as Error).message,
      stack: (error as Error).stack,
    })

    return NextResponse.json(
      { error: `No attestation found for commit ${sha.slice(0, 7)}` },
      { status: 404 },
    )
  }
}

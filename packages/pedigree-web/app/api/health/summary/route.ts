/**
 * Health check endpoint for the summary generation service.
 *
 * Returns the status of watsonx.ai connectivity, cache availability,
 * and overall service health. Used for monitoring and alerting.
 */

import { NextResponse } from 'next/server'
import { createWatsonxClient } from '@/lib/watsonx-client'
import { createSummaryCache } from '@/lib/summary-cache'
import { logger } from '@/lib/logger'

/** Health check response structure. */
interface HealthCheckResponse {
  /** Overall service status. */
  status: 'healthy' | 'degraded' | 'unhealthy'
  /** watsonx.ai API connectivity status. */
  watsonx: {
    configured: boolean
    reachable: boolean | null
  }
  /** Cache availability status. */
  cache: {
    type: string
    available: boolean
    stats?: {
      hits: number
      misses: number
    }
  }
  /** ISO-8601 timestamp of the health check. */
  timestamp: string
  /** Optional error message if unhealthy. */
  error?: string
}

/**
 * GET /api/health/summary
 *
 * Performs health checks on all summary generation dependencies:
 * - watsonx.ai API connectivity (if configured)
 * - Cache availability
 *
 * Returns 200 if healthy/degraded, 503 if unhealthy.
 */
export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const timestamp = new Date().toISOString()

  try {
    // Check watsonx.ai configuration and connectivity
    const watsonxClient = createWatsonxClient()
    const watsonxConfigured = watsonxClient !== null
    let watsonxReachable: boolean | null = null

    if (watsonxConfigured && watsonxClient) {
      try {
        watsonxReachable = await watsonxClient.healthCheck()
      } catch (error) {
        logger.error('watsonx.ai health check failed', { error: (error as Error).message })
        watsonxReachable = false
      }
    }

    // Check cache availability
    const cache = createSummaryCache()
    const cacheType = process.env.SUMMARY_CACHE_TYPE ?? 'filesystem'
    let cacheAvailable = true
    let cacheStats: { hits: number; misses: number } | undefined

    try {
      cacheStats = await cache.stats()
    } catch (error) {
      logger.error('Cache health check failed', { error: (error as Error).message })
      cacheAvailable = false
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy'

    if (!cacheAvailable) {
      // Cache failure is critical - service is unhealthy
      status = 'unhealthy'
    } else if (watsonxConfigured && !watsonxReachable) {
      // watsonx.ai configured but unreachable - degraded (template fallback works)
      status = 'degraded'
    } else {
      // All systems operational (or watsonx.ai not configured, which is fine)
      status = 'healthy'
    }

    const response: HealthCheckResponse = {
      status,
      watsonx: {
        configured: watsonxConfigured,
        reachable: watsonxReachable,
      },
      cache: {
        type: cacheType,
        available: cacheAvailable,
        stats: cacheStats,
      },
      timestamp,
    }

    // Return 503 if unhealthy, 200 otherwise
    const statusCode = status === 'unhealthy' ? 503 : 200

    return NextResponse.json(response, { status: statusCode })
  } catch (error) {
    // Unexpected error during health check
    logger.error('Health check failed', { error: (error as Error).message })

    return NextResponse.json(
      {
        status: 'unhealthy',
        watsonx: {
          configured: false,
          reachable: null,
        },
        cache: {
          type: 'unknown',
          available: false,
        },
        timestamp,
        error: (error as Error).message,
      },
      { status: 503 },
    )
  }
}

// Made with Bob

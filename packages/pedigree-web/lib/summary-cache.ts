/**
 * SHA-based caching for attestation summaries.
 *
 * This module provides a filesystem-based cache for generated summaries.
 * Since predicates are immutable per SHA, cached summaries never expire.
 * The cache is sharded by the first 2 characters of the SHA for better
 * filesystem performance with large numbers of entries.
 */

import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { logger } from './logger'

/** Metadata stored alongside each cached summary. */
interface CachedSummary {
  /** The commit SHA this summary is for. */
  sha: string
  /** The generated summary text. */
  summary: string
  /** When this summary was cached. */
  cachedAt: string
  /** Source of the summary: watsonx.ai or template fallback. */
  source: 'watsonx' | 'template'
}

/** Interface for summary cache implementations. */
export interface SummaryCache {
  /**
   * Retrieves a cached summary for the given SHA.
   * @returns The summary text, or null if not cached.
   */
  get(sha: string): Promise<string | null>

  /**
   * Stores a summary in the cache.
   * @param sha - The commit SHA.
   * @param summary - The summary text to cache.
   * @param source - Whether the summary came from watsonx.ai or template.
   */
  set(sha: string, summary: string, source: 'watsonx' | 'template'): Promise<void>

  /**
   * Checks if a summary exists in the cache without retrieving it.
   */
  has(sha: string): Promise<boolean>

  /**
   * Returns cache statistics for monitoring.
   */
  stats(): Promise<{ hits: number; misses: number }>
}

/**
 * Filesystem-based implementation of SummaryCache.
 *
 * Stores summaries as JSON files in a sharded directory structure:
 * .cache/summaries/ab/abc123def456.json
 *
 * This is suitable for development and small-scale production deployments.
 * For high-traffic production use, consider RedisSummaryCache instead.
 */
export class FilesystemSummaryCache implements SummaryCache {
  private hits = 0
  private misses = 0

  constructor(private readonly cacheDir: string = '.cache/summaries') {}

  async get(sha: string): Promise<string | null> {
    const path = this.getCachePath(sha)

    try {
      const data = await fs.readFile(path, 'utf-8')
      const cached: CachedSummary = JSON.parse(data)
      this.hits++
      return cached.summary
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.misses++
        return null
      }
      // Log unexpected errors but don't throw - cache failures shouldn't break the app
      logger.error(`Cache read error for ${sha}`, { error: (error as Error).message })
      this.misses++
      return null
    }
  }

  async set(sha: string, summary: string, source: 'watsonx' | 'template'): Promise<void> {
    const path = this.getCachePath(sha)
    const dir = dirname(path)

    try {
      // Ensure the shard directory exists
      await fs.mkdir(dir, { recursive: true })

      const cached: CachedSummary = {
        sha,
        summary,
        cachedAt: new Date().toISOString(),
        source,
      }

      await fs.writeFile(path, JSON.stringify(cached, null, 2), 'utf-8')
    } catch (error) {
      // Log but don't throw - cache write failures shouldn't break the app
      logger.error(`Cache write error for ${sha}`, { error: (error as Error).message })
    }
  }

  async has(sha: string): Promise<boolean> {
    const path = this.getCachePath(sha)

    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  async stats(): Promise<{ hits: number; misses: number }> {
    return {
      hits: this.hits,
      misses: this.misses,
    }
  }

  /**
   * Computes the filesystem path for a given SHA.
   * Shards by first 2 characters: .cache/summaries/ab/abc123def456.json
   */
  private getCachePath(sha: string): string {
    const shard = sha.slice(0, 2)
    return join(this.cacheDir, shard, `${sha}.json`)
  }

  /**
   * Clears all cached summaries (admin operation).
   * Use with caution - this is irreversible.
   */
  async clear(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true })
    } catch (error) {
      logger.error('Cache clear error', { error: (error as Error).message })
    }
  }

  /**
   * Returns the total number of cached summaries.
   * This is an expensive operation - use sparingly.
   */
  async size(): Promise<number> {
    let count = 0

    try {
      const shards = await fs.readdir(this.cacheDir)

      for (const shard of shards) {
        const shardPath = join(this.cacheDir, shard)
        const stat = await fs.stat(shardPath)

        if (stat.isDirectory()) {
          const files = await fs.readdir(shardPath)
          count += files.filter((f) => f.endsWith('.json')).length
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Cache size calculation error', { error: (error as Error).message })
      }
    }

    return count
  }
}

/**
 * In-memory cache implementation for testing.
 * Does not persist across process restarts.
 */
export class InMemorySummaryCache implements SummaryCache {
  private cache = new Map<string, CachedSummary>()
  private hits = 0
  private misses = 0

  async get(sha: string): Promise<string | null> {
    const cached = this.cache.get(sha)
    if (cached) {
      this.hits++
      return cached.summary
    }
    this.misses++
    return null
  }

  async set(sha: string, summary: string, source: 'watsonx' | 'template'): Promise<void> {
    this.cache.set(sha, {
      sha,
      summary,
      cachedAt: new Date().toISOString(),
      source,
    })
  }

  async has(sha: string): Promise<boolean> {
    return this.cache.has(sha)
  }

  async stats(): Promise<{ hits: number; misses: number }> {
    return {
      hits: this.hits,
      misses: this.misses,
    }
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  size(): number {
    return this.cache.size
  }
}

/**
 * Creates a summary cache based on environment configuration.
 *
 * @returns A configured SummaryCache instance.
 */
export function createSummaryCache(): SummaryCache {
  const cacheType = process.env.SUMMARY_CACHE_TYPE ?? 'filesystem'
  const cacheDir = process.env.SUMMARY_CACHE_DIR ?? '.cache/summaries'

  switch (cacheType) {
    case 'memory':
      return new InMemorySummaryCache()

    case 'filesystem':
    default:
      return new FilesystemSummaryCache(cacheDir)
  }
}

// Made with Bob

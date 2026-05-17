/**
 * watsonx.ai API client for generating natural language summaries.
 *
 * This module provides a typed interface to IBM watsonx.ai's text generation
 * API, specifically configured for the Granite 3.3 8B Instruct model. It
 * includes retry logic, timeout handling, and structured error types for
 * graceful degradation when the service is unavailable.
 */

/** Configuration for the watsonx.ai client. */
export interface WatsonxConfig {
  /** IBM Cloud API key for authentication. */
  apiKey: string
  /** watsonx.ai project ID. */
  projectId: string
  /** Base URL for the watsonx.ai API. */
  baseUrl?: string
  /** Request timeout in milliseconds. */
  timeout?: number
}

/** Parameters for text generation requests. */
export interface GenerationParams {
  /** Maximum number of tokens to generate. */
  maxTokens?: number
  /** Sampling temperature (0.0 = deterministic, 1.0 = creative). */
  temperature?: number
  /** Nucleus sampling threshold. */
  topP?: number
  /** Penalty for repeating tokens. */
  repetitionPenalty?: number
  /** Sequences that stop generation when encountered. */
  stopSequences?: string[]
}

/** Error codes for watsonx.ai failures. */
export type WatsonxErrorCode =
  | 'TIMEOUT'
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'INVALID_RESPONSE'

/**
 * Custom error class for watsonx.ai API failures.
 * Includes structured error codes for different failure modes.
 */
export class WatsonxError extends Error {
  constructor(
    message: string,
    public readonly code: WatsonxErrorCode,
    public readonly statusCode?: number,
    public readonly response?: unknown,
  ) {
    super(message)
    this.name = 'WatsonxError'
  }
}

/** Default configuration values. */
const DEFAULTS = {
  baseUrl: 'https://us-south.ml.cloud.ibm.com',
  timeout: 10000,
  maxTokens: 150,
  temperature: 0.3,
  topP: 0.9,
  repetitionPenalty: 1.1,
  stopSequences: ['\n\n'],
} as const

/** Retry configuration for transient failures. */
const RETRY_CONFIG = {
  maxRetries: 2,
  retryableErrors: ['TIMEOUT', 'SERVER_ERROR'] as WatsonxErrorCode[],
  backoffMs: [1000, 2000],
} as const

/**
 * Client for IBM watsonx.ai text generation API.
 *
 * Configured specifically for Granite 3.3 8B Instruct with low temperature
 * for factual, deterministic output. Includes automatic retry logic for
 * transient failures and structured error handling.
 */
export class WatsonxClient {
  private readonly config: Required<WatsonxConfig>

  constructor(config: WatsonxConfig) {
    this.config = {
      baseUrl: config.baseUrl ?? DEFAULTS.baseUrl,
      timeout: config.timeout ?? DEFAULTS.timeout,
      apiKey: config.apiKey,
      projectId: config.projectId,
    }
  }

  /**
   * Generates text using the Granite 3.3 8B Instruct model.
   *
   * @param prompt - The input prompt for text generation.
   * @param params - Optional generation parameters (uses defaults if not provided).
   * @returns The generated text, trimmed of leading/trailing whitespace.
   * @throws {WatsonxError} When the API request fails or returns invalid data.
   */
  async generateText(prompt: string, params?: GenerationParams): Promise<string> {
    return this.generateTextWithRetry(prompt, params, 0)
  }

  /**
   * Internal method that implements retry logic for text generation.
   */
  private async generateTextWithRetry(
    prompt: string,
    params: GenerationParams | undefined,
    attempt: number,
  ): Promise<string> {
    try {
      return await this.generateTextInternal(prompt, params)
    } catch (error) {
      if (error instanceof WatsonxError && this.shouldRetry(error, attempt)) {
        const backoffMs = RETRY_CONFIG.backoffMs[attempt] ?? 2000
        await this.sleep(backoffMs)
        return this.generateTextWithRetry(prompt, params, attempt + 1)
      }
      throw error
    }
  }

  /**
   * Core text generation logic without retry.
   */
  private async generateTextInternal(prompt: string, params?: GenerationParams): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(
        `${this.config.baseUrl}/ml/v1/text/generation?version=2023-05-29`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
            'User-Agent': 'Pedigree/1.0.0',
          },
          body: JSON.stringify({
            model_id: 'ibm/granite-3-8b-instruct',
            input: prompt,
            parameters: {
              max_new_tokens: params?.maxTokens ?? DEFAULTS.maxTokens,
              temperature: params?.temperature ?? DEFAULTS.temperature,
              top_p: params?.topP ?? DEFAULTS.topP,
              repetition_penalty: params?.repetitionPenalty ?? DEFAULTS.repetitionPenalty,
              stop_sequences: params?.stopSequences ?? DEFAULTS.stopSequences,
            },
            project_id: this.config.projectId,
          }),
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      const data = await response.json()
      const generatedText = this.extractGeneratedText(data)

      return generatedText.trim()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof WatsonxError) {
        throw error
      }

      if ((error as Error).name === 'AbortError') {
        throw new WatsonxError('Request timeout', 'TIMEOUT')
      }

      throw new WatsonxError(
        `Network error: ${(error as Error).message}`,
        'SERVER_ERROR',
        undefined,
        error,
      )
    }
  }

  /**
   * Handles non-2xx HTTP responses from the watsonx.ai API.
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const statusCode = response.status
    let errorBody: unknown

    try {
      errorBody = await response.json()
    } catch {
      errorBody = await response.text()
    }

    if (statusCode === 401 || statusCode === 403) {
      throw new WatsonxError('Authentication failed', 'AUTH', statusCode, errorBody)
    }

    if (statusCode === 429) {
      throw new WatsonxError('Rate limit exceeded', 'RATE_LIMIT', statusCode, errorBody)
    }

    if (statusCode >= 500) {
      throw new WatsonxError('Server error', 'SERVER_ERROR', statusCode, errorBody)
    }

    throw new WatsonxError(
      `HTTP ${statusCode}: ${JSON.stringify(errorBody)}`,
      'INVALID_RESPONSE',
      statusCode,
      errorBody,
    )
  }

  /**
   * Extracts the generated text from the watsonx.ai API response.
   */
  private extractGeneratedText(data: unknown): string {
    if (!data || typeof data !== 'object') {
      throw new WatsonxError('Invalid response format', 'INVALID_RESPONSE', undefined, data)
    }

    const results = (data as { results?: unknown[] }).results
    if (!Array.isArray(results) || results.length === 0) {
      throw new WatsonxError('No results in response', 'INVALID_RESPONSE', undefined, data)
    }

    const generatedText = (results[0] as { generated_text?: unknown }).generated_text
    if (typeof generatedText !== 'string') {
      throw new WatsonxError('Missing generated_text field', 'INVALID_RESPONSE', undefined, data)
    }

    return generatedText
  }

  /**
   * Determines whether a failed request should be retried.
   */
  private shouldRetry(error: WatsonxError, attempt: number): boolean {
    if (attempt >= RETRY_CONFIG.maxRetries) {
      return false
    }
    return RETRY_CONFIG.retryableErrors.includes(error.code)
  }

  /**
   * Checks if the watsonx.ai API is reachable and responding.
   *
   * @returns True if the health check succeeds, false otherwise.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.config.baseUrl}/ml/v1/deployments?version=2023-05-29`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Utility method for async sleep (used in retry backoff).
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Creates a watsonx.ai client from environment variables.
 *
 * @returns A configured WatsonxClient, or null if credentials are missing.
 */
export function createWatsonxClient(): WatsonxClient | null {
  const apiKey = process.env.WATSONX_API_KEY
  const projectId = process.env.WATSONX_PROJECT_ID

  if (!apiKey || !projectId) {
    return null
  }

  return new WatsonxClient({
    apiKey,
    projectId,
    baseUrl: process.env.WATSONX_BASE_URL,
    timeout: process.env.WATSONX_TIMEOUT_MS
      ? parseInt(process.env.WATSONX_TIMEOUT_MS, 10)
      : undefined,
  })
}

// Made with Bob

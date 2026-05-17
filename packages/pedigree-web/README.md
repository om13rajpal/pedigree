# Pedigree Web

Next.js 14 web application for visualizing and exploring Pedigree attestations. Provides a landing page with architecture visualization and individual commit "passport" pages showing the full chain of custody.

## Features

- **Landing Page** (`/`): Scroll-driven architecture visualization with GSAP animations
- **Passport Pages** (`/passport/[sha]`): Detailed commit provenance with QR codes and Rekor links
- **AI-Generated Summaries** (`/api/summary/[sha]`): Natural language explanations powered by watsonx.ai Granite 3.3 8B Instruct

## watsonx.ai Integration

The summary API uses IBM watsonx.ai Granite 3.3 8B Instruct to generate human-readable explanations of attestation predicates. The system implements a cache-first strategy with graceful fallback to template-based summaries.

### Architecture

```
GET /api/summary/[sha]
    ↓
[Cache Check] → Hit? Return cached summary (< 100ms)
    ↓ Miss
[Fetch Attestation]
    ↓
[Try watsonx.ai] → Success? Cache & return (~2s)
    ↓ Failure
[Template Fallback] → Cache & return (~50ms)
```

### Configuration

#### Required Environment Variables

```bash
# watsonx.ai API credentials (optional - falls back to templates if missing)
WATSONX_API_KEY=
WATSONX_PROJECT_ID=your_project_id_here
```

#### Optional Environment Variables

```bash
# watsonx.ai Configuration
WATSONX_BASE_URL=https://us-south.ml.cloud.ibm.com  # Default
WATSONX_TIMEOUT_MS=10000  # Default: 10 seconds

# Cache Configuration
SUMMARY_CACHE_TYPE=filesystem  # Options: filesystem, memory
SUMMARY_CACHE_DIR=.cache/summaries  # Default

# Feature Flags
ENABLE_WATSONX_SUMMARIES=true  # Default: true
ENABLE_SUMMARY_CACHE=true  # Default: true
```

### Setup

1. **Obtain watsonx.ai Credentials**

   - Create an IBM Cloud account at https://cloud.ibm.com
   - Provision a watsonx.ai instance
   - Create a project and note the Project ID
   - Generate an API key from IAM

2. **Configure Environment Variables**

   ```bash
   cp .env.example .env
   # Edit .env and add your credentials
   ```

3. **Install Dependencies**

   ```bash
   pnpm install
   ```

4. **Run Development Server**

   ```bash
   pnpm dev
   ```

5. **Test the Summary API**

   ```bash
   curl http://localhost:3000/api/summary/abc123def456
   ```

   Expected response:

   ```json
   {
     "sha": "abc123def456",
     "summary": "This commit was produced through AI-assisted development (15% human contribution) using ibm-bob with the granite-3.3-8b-instruct model. The changes modified 3 medium-risk files (src/auth/login.ts, src/auth/session.ts, tests/auth.test.ts), adding 47 lines and removing 12. Human approval was required and granted by omrajpal.exe@gmail.com, satisfying the repository's provenance policy.",
     "cached": false,
     "source": "watsonx",
     "latencyMs": 1847
   }
   ```

### API Endpoints

#### `GET /api/summary/[sha]`

Returns a human-readable summary of a commit's attestation.

**Parameters:**

- `sha` (path): Git commit SHA (minimum 7 characters)

**Response:**

```typescript
{
  sha: string // The commit SHA
  summary: string // 2-3 sentence summary
  cached: boolean // Whether this was served from cache
  source: 'watsonx' | 'template' // Summary generation source
  latencyMs: number // Request latency in milliseconds
}
```

**Status Codes:**

- `200`: Success
- `400`: Invalid SHA format
- `404`: Attestation not found

#### `GET /api/health/summary`

Health check endpoint for monitoring the summary service.

**Response:**

```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy'
  watsonx: {
    configured: boolean    // Whether watsonx.ai is configured
    reachable: boolean | null  // Whether watsonx.ai API is reachable
  }
  cache: {
    type: string          // Cache type (filesystem, memory)
    available: boolean    // Whether cache is operational
    stats?: {
      hits: number        // Cache hit count
      misses: number      // Cache miss count
    }
  }
  timestamp: string       // ISO-8601 timestamp
  error?: string          // Error message if unhealthy
}
```

**Status Codes:**

- `200`: Healthy or degraded (template fallback available)
- `503`: Unhealthy (cache failure)

### Monitoring

The summary service logs structured data for all operations:

```typescript
// Cache hit
console.log('Cache hit', { sha: 'abc123d', latencyMs: 42 })

// watsonx.ai success
console.log('Generated summary via watsonx.ai', {
  sha: 'abc123d',
  latencyMs: 1847,
  fields: { authorshipKind: 'ai-assisted', riskClass: 'medium', ... }
})

// watsonx.ai failure (fallback triggered)
console.warn('watsonx.ai failed, using template fallback', {
  sha: 'abc123d',
  error: 'Request timeout',
  errorCode: 'TIMEOUT'
})
```

### Performance

- **Cache Hit (P50):** < 100ms
- **Cache Miss + watsonx.ai (P95):** < 2s
- **Cache Miss + Template Fallback (P95):** < 100ms
- **Cache Hit Rate (after 1 week):** > 80%

### Cost Estimation

- **Per Summary:** ~$0.0004 (400 tokens @ $1/1M tokens)
- **Monthly (100K requests, 80% cache hit rate):** ~$8
- **Cache Storage:** Negligible (< 1MB per 1000 summaries)

### Troubleshooting

#### watsonx.ai Returns 401 Unauthorized

- Verify `WATSONX_API_KEY` is correct
- Check API key has not expired
- Ensure API key has access to the project

#### Summaries Always Use Template Fallback

- Check `ENABLE_WATSONX_SUMMARIES=true` in `.env`
- Verify watsonx.ai credentials are set
- Check health endpoint: `curl http://localhost:3000/api/health/summary`
- Review logs for error messages

#### Cache Not Working

- Check `ENABLE_SUMMARY_CACHE=true` in `.env`
- Verify `.cache/summaries/` directory is writable
- Check disk space availability
- Review logs for cache write errors

#### Slow Response Times

- Check cache hit rate in health endpoint
- Verify watsonx.ai region matches `WATSONX_BASE_URL`
- Consider increasing `WATSONX_TIMEOUT_MS` if network is slow
- Monitor watsonx.ai API status page

### Development

#### Running Tests

```bash
# Run all tests
pnpm test

# Run summary tests only
pnpm test summary

# Run with coverage
pnpm test:coverage
```

#### Clearing Cache

```bash
# Clear filesystem cache
rm -rf .cache/summaries/

# Or use the admin endpoint (if implemented)
curl -X DELETE http://localhost:3000/api/admin/cache/summaries
```

#### Testing with Mock Data

The summary API works with mock attestation data in development:

```bash
# Any SHA will return mock data
curl http://localhost:3000/api/summary/test123
```

### Production Deployment

#### Vercel

1. Add environment variables in Vercel dashboard
2. Deploy: `vercel --prod`
3. Monitor health: `https://your-app.vercel.app/api/health/summary`

#### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
```

#### Environment Variables in Production

- Store `WATSONX_API_KEY` in a secret manager (AWS Secrets Manager, Vault, etc.)
- Use separate watsonx.ai projects for staging and production
- Enable cache in production: `ENABLE_SUMMARY_CACHE=true`
- Consider Redis cache for multi-instance deployments

### Security

- **API Key Storage:** Never commit `.env` files. Use secret managers in production.
- **Rate Limiting:** Implement per-IP rate limiting on `/api/summary/*` endpoints (100 req/min recommended).
- **Cache Permissions:** Set restrictive permissions on `.cache/` directory (`chmod 700`).
- **CORS:** Configure CORS headers if exposing API to external clients.

### Future Enhancements

- [ ] Redis cache for multi-instance deployments
- [ ] Multilingual summaries (detect user locale)
- [ ] Manual summary overrides with audit trail
- [ ] Pre-generation of summaries for popular commits
- [ ] Summary quality feedback mechanism
- [ ] A/B testing of prompt templates

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Animations:** GSAP, Framer Motion
- **UI Components:** shadcn/ui, Magic UI
- **AI:** IBM watsonx.ai (Granite 3.3 8B Instruct)
- **Type Safety:** TypeScript, Zod

## License

See [LICENSE](../../LICENSE) in the repository root.

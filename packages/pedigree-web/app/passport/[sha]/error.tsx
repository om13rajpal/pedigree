/** Error boundary for the Passport page with branded messaging. */
'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Props provided by Next.js to error boundary components.
 */
interface ErrorBoundaryProps {
  /** The error thrown during rendering or data fetching. */
  error: Error & { digest?: string }
  /** Callback to re-render the page segment. */
  reset: () => void
}

/**
 * Error boundary displayed when the Passport page fails to load.
 *
 * Shows a structured error message with possible reasons and recovery
 * actions. Uses a matter-of-fact tone with no exclamation marks or
 * "oops" language. Errors are logged for debugging but raw messages
 * are never exposed to end users.
 *
 * @param error - The caught error.
 * @param reset - Callback to retry rendering.
 */
export default function PassportError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Structured error logging -- replace with a real logger in production
    // eslint-disable-next-line no-console
    console.error('[PassportError]', { message: error.message, digest: error.digest })
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AlertTriangle className="h-6 w-6 text-warning" aria-hidden="true" />
        </div>
        <h2 className="text-center text-sm font-semibold text-neutral-950 dark:text-neutral-50">
          This commit could not be verified
        </h2>
        <p className="max-w-sm text-center text-xs text-neutral-500 dark:text-neutral-400">
          The attestation for this commit could not be retrieved or validated.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg bg-neutral-50 p-4 dark:bg-neutral-900">
        <p className="mb-2 text-2xs font-medium text-neutral-600 dark:text-neutral-300">
          Possible reasons
        </p>
        <ul className="list-inside list-disc space-y-1 text-2xs text-neutral-500 dark:text-neutral-400">
          <li>The commit SHA may be incorrect or incomplete</li>
          <li>No attestation exists for this commit</li>
          <li>The Rekor transparency log may be temporarily unavailable</li>
          <li>The attestation may have been revoked or expired</li>
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button variant="ghost" asChild>
          <a href="/">Back to home</a>
        </Button>
      </div>
    </main>
  )
}

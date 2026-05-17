/** Interactive SHA input for looking up any commit's passport. */

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

/** Minimum SHA length for a valid lookup. */
const MIN_SHA_LENGTH = 7

/** Maximum SHA length (full hex). */
const MAX_SHA_LENGTH = 40

/** Hex character pattern. */
const HEX_REGEX = /^[0-9a-f]+$/i

/**
 * A form that accepts a commit SHA and navigates to its Passport page.
 *
 * Validates that the input is a valid hex string of at least 7 characters.
 * On submit, navigates to /passport/<sha>. The passport page handles
 * live vs. mock resolution automatically.
 */
export function ShaLookup() {
  const router = useRouter()
  const [sha, setSha] = React.useState('')
  const [error, setError] = React.useState('')

  const isValid = sha.length >= MIN_SHA_LENGTH && HEX_REGEX.test(sha)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmed = sha.trim().toLowerCase()

    if (trimmed.length < MIN_SHA_LENGTH) {
      setError(`SHA must be at least ${MIN_SHA_LENGTH} characters`)
      return
    }

    if (trimmed.length > MAX_SHA_LENGTH) {
      setError(`SHA cannot exceed ${MAX_SHA_LENGTH} characters`)
      return
    }

    if (!HEX_REGEX.test(trimmed)) {
      setError('SHA must be a valid hex string (0-9, a-f)')
      return
    }

    router.push(`/passport/${trimmed}`)
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={sha}
            onChange={(e) => {
              setSha(e.target.value)
              setError('')
            }}
            placeholder="e.g. 4a2167236fe88df14bfa51eabf38c27c4fd1fb7c"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-200/60 bg-white py-2.5 pl-10 pr-4 font-mono text-xs text-neutral-950 placeholder-neutral-400 shadow-subtle transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-neutral-700/60 dark:bg-neutral-900 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus:border-accent-dark dark:focus:ring-accent-dark/20"
            aria-label="Commit SHA"
          />
        </div>
        <button
          type="submit"
          disabled={!isValid}
          className="shrink-0 rounded-lg bg-accent px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent-dark dark:hover:bg-accent"
        >
          View Passport
        </button>
      </div>

      {error && (
        <p className="text-center text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <p className="text-center text-2xs text-neutral-400 dark:text-neutral-500">
        Attested commits show real ed25519-signed data with full chain of custody verification.
      </p>
    </form>
  )
}

/** Outbound link to the Rekor transparency log entry. */

import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Props for the RekorLink component.
 */
interface RekorLinkProps {
  /** Full URL to the Rekor transparency log entry. */
  href: string
}

/**
 * An outbound link to a Rekor transparency log entry.
 *
 * Opens in a new tab with appropriate security attributes. Includes
 * an external-link icon and accessible labeling for screen readers.
 *
 * @param href - The URL to the Rekor log entry.
 */
export function RekorLink({ href }: RekorLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View entry in Rekor transparency log (opens in new tab)"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        'text-accent hover:text-accent-hover hover:underline',
        'dark:text-accent-dark dark:hover:text-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'transition-colors',
      )}
    >
      <span>View in Rekor transparency log</span>
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  )
}

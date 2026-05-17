/** Landing page footer with attribution and navigation links. */

import * as React from 'react'
import Link from 'next/link'

/** External link to the GitHub repository. */
const GITHUB_URL = 'https://github.com/om13rajpal/pedigree'

/** Internal link to the predicate specification documentation. */
const SPEC_URL = '/docs/predicate-spec'

/**
 * Simple footer with project attribution, hackathon context, and links.
 *
 * Uses semantic HTML footer element. All links include proper
 * external-link attributes and accessible focus rings.
 */
function Footer() {
  return (
    <footer className="border-t border-neutral-200/60 dark:border-neutral-700/60">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Built by{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Om Rajpal</span>
          </p>
          <p className="text-2xs text-neutral-400 dark:text-neutral-500">
            For the IBM Bob Hackathon 2026
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex items-center gap-4">
          <FooterLink href={GITHUB_URL} external>
            GitHub
          </FooterLink>
          <FooterLink href={SPEC_URL}>Predicate Spec</FooterLink>
        </nav>

        <p className="text-2xs text-neutral-400 dark:text-neutral-500">MIT License</p>
      </div>
    </footer>
  )
}

/**
 * Props for the FooterLink component.
 */
interface FooterLinkProps {
  /** Link destination. */
  href: string
  /** Whether the link opens an external site. */
  external?: boolean
  /** Link text. */
  children: React.ReactNode
}

/**
 * A styled navigation link used within the footer.
 */
function FooterLink({ href, external = false, children }: FooterLinkProps) {
  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="text-xs text-neutral-500 underline-offset-4 transition-colors hover:text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-neutral-400 dark:hover:text-neutral-50"
    >
      {children}
    </Link>
  )
}

export { Footer }

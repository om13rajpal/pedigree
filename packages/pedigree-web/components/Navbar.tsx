/** Site-wide navigation bar with logo and links. */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileCheck2, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Navigation links shown in the navbar. */
const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/demo', label: 'Demo' },
  { href: '/how-it-works', label: 'How it Works' },
  { href: '/setup', label: 'Setup' },
  { href: '/docs/predicate-spec', label: 'Spec' },
  { href: 'https://github.com/om13rajpal/pedigree', label: 'GitHub', external: true },
] as const

/**
 * Fixed top navbar with logo and navigation links.
 *
 * Collapses to a hamburger menu on mobile. Active link is highlighted
 * based on the current pathname.
 */
export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-neutral-200/60 bg-white/80 backdrop-blur-md dark:border-neutral-700/60 dark:bg-neutral-950/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-accent dark:text-accent-dark" aria-hidden="true" />
          <span className="font-mono text-sm font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
            PEDIGREE
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              active={pathname === link.href}
              external={'external' in link && link.external}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 transition-colors hover:text-neutral-950 sm:hidden dark:text-neutral-400 dark:hover:text-neutral-50"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-neutral-200/60 bg-white px-4 py-3 sm:hidden dark:border-neutral-700/60 dark:bg-neutral-950">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                active={pathname === link.href}
                external={'external' in link && link.external}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}

interface NavLinkProps {
  href: string
  active: boolean
  external?: boolean
  onClick?: () => void
  children: React.ReactNode
}

function NavLink({ href, active, external, onClick, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(
        'text-xs font-medium transition-colors',
        active
          ? 'text-accent dark:text-accent-dark'
          : 'text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-50',
      )}
    >
      {children}
    </Link>
  )
}

/** Collapsible JSON viewer for the raw Pedigree predicate payload. */

'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Copy, Check } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useRespectMotion } from '@/components/motion/respect-motion'
import { cn } from '@/lib/utils'
import type { PedigreePredicate } from 'pedigree-types'

/**
 * Props for the PredicateInspector component.
 */
interface PredicateInspectorProps {
  /** The Pedigree predicate to display as formatted JSON. */
  predicate: PedigreePredicate
}

/**
 * Applies manual syntax coloring to a JSON string for display.
 *
 * Wraps JSON keys, string values, numbers, booleans, and null in
 * span elements with Tailwind color classes matching the design tokens.
 * This avoids pulling in a full syntax highlighting library.
 *
 * @param json - A pre-formatted JSON string (from JSON.stringify with indentation).
 * @returns An array of React elements with colored spans.
 */
function colorizeJson(json: string): React.ReactNode[] {
  const lines = json.split('\n')

  return lines.map((line, index) => {
    const colored = line
      // Keys (quoted strings followed by colon)
      .replace(/"([^"]+)"(?=\s*:)/g, '<span class="text-sky-400">"$1"</span>')
      .replace(/:\s*"([^"]*)"([,]?)$/gm, ': <span class="text-emerald-400">"$1"</span>$2')
      .replace(/^\s*"([^"]+)"([,]?)$/gm, (match, value: string, _comma: string) => {
        if (match.includes(':')) return match
        return match.replace(`"${value}"`, `<span class="text-emerald-400">"${value}"</span>`)
      })
      .replace(/:\s*(\d+\.?\d*)([,]?)$/gm, ': <span class="text-amber-300">$1</span>$2')
      .replace(/:\s*(true|false)([,]?)$/gm, ': <span class="text-violet-400">$1</span>$2')
      .replace(/:\s*(null)([,]?)$/gm, ': <span class="text-rose-400">$1</span>$2')

    return <span key={index} dangerouslySetInnerHTML={{ __html: colored }} />
  })
}

/**
 * Collapsible viewer for the raw Pedigree predicate JSON.
 *
 * Renders a toggle button that expands to show the full predicate
 * with manual syntax coloring. Includes a copy-to-clipboard button
 * with inline confirmation feedback. Uses AnimatePresence for smooth
 * expand/collapse transitions.
 *
 * @param predicate - The predicate object to display.
 */
export function PredicateInspector({ predicate }: PredicateInspectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { transition } = useRespectMotion()

  const jsonString = useMemo(() => JSON.stringify(predicate, null, 2), [predicate])

  const coloredLines = useMemo(() => colorizeJson(jsonString), [jsonString])

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [jsonString])

  return (
    <section aria-label="Raw predicate inspector">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border px-4 py-3 transition-colors',
          isOpen
            ? 'border-accent/30 bg-accent/5 dark:border-accent-dark/30 dark:bg-accent-dark/5'
            : 'border-neutral-200/60 bg-neutral-50 hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:hover:border-neutral-600 dark:hover:bg-neutral-800',
        )}
      >
        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          View Raw Predicate
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-neutral-400 transition-transform dark:text-neutral-500',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="predicate-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition}
            className="overflow-hidden"
          >
            <div className="mt-3 overflow-hidden rounded-lg border border-neutral-700/40 bg-neutral-950">
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                  <span className="ml-2 text-2xs text-neutral-500">predicate.json</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy predicate JSON to clipboard"
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-2xs',
                    'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900',
                    'transition-colors',
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-neutral-200">
                <code>
                  {coloredLines.map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < coloredLines.length - 1 && '\n'}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

/** Architecture flow visualization -- the hero moment of the landing page. */

'use client'

import * as React from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { User, Bot, Server, ShieldCheck, Database } from 'lucide-react'

/**
 * Configuration for a single flow node in the architecture diagram.
 */
interface FlowNode {
  /** Unique identifier. */
  id: string
  /** Display label below the icon. */
  label: string
  /** Short description rendered below the label. */
  description: string
  /** The Lucide icon component to render. */
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
}

/** The five architecture nodes in pipeline order. */
const FLOW_NODES: readonly FlowNode[] = [
  {
    id: 'developer',
    label: 'Developer',
    description: 'Writes code with AI',
    icon: User,
  },
  {
    id: 'bob',
    label: 'Bob',
    description: 'Provenance Officer mode',
    icon: Bot,
  },
  {
    id: 'mcp',
    label: 'pedigree-mcp',
    description: 'Builds the attestation',
    icon: Server,
  },
  {
    id: 'sigstore',
    label: 'Sigstore',
    description: 'Signs with OIDC identity',
    icon: ShieldCheck,
  },
  {
    id: 'rekor',
    label: 'Rekor',
    description: 'Public transparency log',
    icon: Database,
  },
] as const

/**
 * Scroll-driven architecture flow revealing the Pedigree pipeline.
 *
 * Nodes appear one-by-one as the user scrolls, with animated connector
 * beams drawing between them. Uses GSAP ScrollTrigger with scrub for
 * a direct scroll-to-progress mapping. When reduced motion is preferred,
 * all nodes render immediately without animation.
 */
function ArchitectureFlow() {
  const sectionRef = React.useRef<HTMLElement>(null)
  const nodesRef = React.useRef<(HTMLDivElement | null)[]>([])
  const connectorsRef = React.useRef<(HTMLDivElement | null)[]>([])
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  React.useLayoutEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      /* Show everything immediately for reduced motion */
      nodesRef.current.forEach((node) => {
        if (node) {
          node.style.opacity = '1'
          node.style.transform = 'translateY(0)'
        }
      })
      connectorsRef.current.forEach((conn) => {
        if (conn) conn.style.transform = 'scaleX(1)'
      })
      if (headingRef.current) {
        headingRef.current.style.opacity = '1'
        headingRef.current.style.transform = 'translateY(0)'
      }
      return
    }

    gsap.registerPlugin(ScrollTrigger)

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 60%',
          end: 'bottom 40%',
          scrub: 0.5,
        },
      })

      /* Heading fades in first */
      tl.fromTo(headingRef.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.3 })

      /* Reveal each node + its preceding connector */
      FLOW_NODES.forEach((_, i) => {
        if (i > 0) {
          const connector = connectorsRef.current[i - 1]
          if (connector) {
            tl.fromTo(
              connector,
              { scaleX: 0 },
              { scaleX: 1, duration: 0.3, ease: 'power2.out' },
              `>-0.1`,
            )
          }
        }
        const node = nodesRef.current[i]
        if (node) {
          tl.fromTo(
            node,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
            i === 0 ? '>' : '>-0.15',
          )
        }
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="mx-auto w-full max-w-5xl px-4 py-32"
      aria-label="How Pedigree works"
    >
      <h2
        ref={headingRef}
        className="mb-16 text-center text-xl font-bold tracking-tight text-neutral-950 opacity-0 dark:text-neutral-50 sm:text-2xl"
      >
        From keystroke to transparency log
      </h2>

      <div
        className="relative flex flex-col items-center gap-8 sm:flex-row sm:gap-0 sm:justify-between"
        role="list"
        aria-label="Architecture pipeline"
      >
        {FLOW_NODES.map((node, i) => (
          <React.Fragment key={node.id}>
            {i > 0 && (
              <div
                ref={(el) => {
                  connectorsRef.current[i - 1] = el
                }}
                aria-hidden="true"
                className="hidden h-px flex-1 origin-left scale-x-0 bg-gradient-to-r from-accent/40 to-accent/10 dark:from-accent-dark/40 dark:to-accent-dark/10 sm:block"
              />
            )}
            <div
              ref={(el) => {
                nodesRef.current[i] = el
              }}
              role="listitem"
              className="flex w-28 translate-y-5 flex-col items-center gap-3 opacity-0 sm:w-32"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-neutral-200/60 bg-white shadow-subtle dark:border-neutral-700/60 dark:bg-neutral-900">
                <node.icon
                  className="h-6 w-6 text-accent dark:text-accent-dark"
                  aria-hidden="true"
                />
              </div>
              <span className="text-center text-xs font-semibold text-neutral-950 dark:text-neutral-50">
                {node.label}
              </span>
              <span className="text-center text-2xs text-neutral-500 dark:text-neutral-400">
                {node.description}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}

export { ArchitectureFlow }

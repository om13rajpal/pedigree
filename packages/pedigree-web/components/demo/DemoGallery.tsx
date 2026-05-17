/** Gallery of pre-attested commits from the Pedigree repo. */

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { FileCheck2, ArrowRight, GitCommit } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRespectMotion } from '@/components/motion/respect-motion'

/** Stagger interval between gallery cards in seconds. */
const STAGGER_S = 0.06

/**
 * A pre-attested commit to show in the gallery.
 */
interface DemoCommit {
  sha: string
  shortSha: string
  message: string
  author: string
  date: string
  riskClass: 'low' | 'medium' | 'high'
  isAttested: boolean
}

/** Real commits from the Pedigree repo that have been attested. */
const DEMO_COMMITS: readonly DemoCommit[] = [
  {
    sha: '4a2167236fe88df14bfa51eabf38c27c4fd1fb7c',
    shortSha: '4a21672',
    message: 'docs: polish README and fix formatting across codebase',
    author: 'Om Rajpal',
    date: 'May 16, 2026',
    riskClass: 'low',
    isAttested: true,
  },
  {
    sha: 'ab8fe71c33df057696f1aa761f8af782b8631e01',
    shortSha: 'ab8fe71',
    message: 'fix(web): rename unused parameter in template summary',
    author: 'Om Rajpal',
    date: 'May 16, 2026',
    riskClass: 'medium',
    isAttested: true,
  },
  {
    sha: 'af17f5c07fc71f8bb0f79339dbe14cf7a661faf6',
    shortSha: 'af17f5c',
    message: 'feat(demo): add cross-agent attestation and passport demo scripts',
    author: 'Om Rajpal',
    date: 'May 16, 2026',
    riskClass: 'medium',
    isAttested: true,
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER_S } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

/**
 * Renders a gallery of pre-attested commits as clickable cards.
 *
 * Each card links to the full Passport page. Cards stagger in with
 * a fade-up animation. The "Live" badge indicates real attestation data.
 */
export function DemoGallery() {
  const { transition, isReduced } = useRespectMotion()

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-center gap-2">
        <FileCheck2 className="h-5 w-5 text-accent dark:text-accent-dark" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          Attested Commits
        </h2>
      </div>

      <motion.div
        className="flex flex-col gap-4"
        variants={containerVariants}
        initial={isReduced ? 'visible' : 'hidden'}
        animate="visible"
      >
        {DEMO_COMMITS.map((commit) => (
          <motion.div key={commit.sha} variants={cardVariants} transition={transition}>
            <Link href={`/passport/${commit.sha}`} className="group block">
              <Card className="transition-shadow hover:shadow-lifted">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle dark:bg-accent-dark/10">
                    <GitCommit
                      className="h-5 w-5 text-accent dark:text-accent-dark"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-semibold text-accent dark:text-accent-dark">
                        {commit.shortSha}
                      </code>
                      {commit.isAttested && (
                        <Badge
                          variant="outline"
                          className="border-accent text-accent dark:border-accent-dark dark:text-accent-dark"
                        >
                          Live
                        </Badge>
                      )}
                      <Badge variant={commit.riskClass === 'low' ? 'success' : 'warning'}>
                        {commit.riskClass}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-neutral-600 dark:text-neutral-400">
                      {commit.message}
                    </p>
                    <p className="text-2xs text-neutral-400 dark:text-neutral-500">
                      {commit.author} -- {commit.date}
                    </p>
                  </div>

                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-1 group-hover:text-accent dark:text-neutral-600 dark:group-hover:text-accent-dark"
                    aria-hidden="true"
                  />
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}

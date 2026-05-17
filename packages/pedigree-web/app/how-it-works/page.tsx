import type { Metadata } from 'next'
import { AnimatedPipeline } from '@/components/how-it-works/AnimatedPipeline'
import { InteractiveSequence } from '@/components/how-it-works/InteractiveSequence'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How Pedigree Works -- From Code to Transparency Log',
  description:
    'Visual walkthrough of the Pedigree attestation pipeline: code authorship detection, predicate assembly, DSSE signing, and Rekor transparency logging.',
}

export default function HowItWorksPage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 pt-20 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-xs font-medium text-accent dark:border-accent-dark/20 dark:bg-accent-dark/10 dark:text-accent-dark">
          Architecture
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-4xl">
          How Pedigree Works
        </h1>
        <p className="max-w-lg text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Six cryptographic checkpoints turn every AI-authored commit into a verifiable,
          tamper-evident credential. Your development workflow stays unchanged.
        </p>
      </section>

      {/* Animated pipeline */}
      <AnimatedPipeline />

      <div className="mx-auto h-px w-full max-w-4xl bg-neutral-200/60 dark:bg-neutral-700/60" />

      {/* Interactive deep-dive */}
      <InteractiveSequence />

      <div className="mx-auto h-px w-full max-w-4xl bg-neutral-200/60 dark:bg-neutral-700/60" />

      {/* Three authorship kinds */}
      <section className="mx-auto w-full max-w-4xl px-4 py-24">
        <div className="mb-12 text-center">
          <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-2xl">
            Three authorship scenarios
          </h2>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            The predicate schema captures every point on the human-AI spectrum.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <AuthorshipCard
            kind="Human Only"
            kindLabel="human"
            humanShare="1.0"
            description="Developer writes every line. No AI involvement. Agent and execution fields are absent."
            color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <AuthorshipCard
            kind="AI-Assisted"
            kindLabel="ai-assisted"
            humanShare="0.0 to 1.0"
            description="Human and AI collaborate. humanShare records the fraction. Both agent and execution captured."
            color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          />
          <AuthorshipCard
            kind="AI Autonomous"
            kindLabel="ai-autonomous"
            humanShare="null"
            description="AI generates code independently. Human may approve but did not write. humanShare is null."
            color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-24 text-center">
        <div className="rounded-xl border border-neutral-200/60 bg-gradient-to-b from-white to-neutral-50/50 p-8 shadow-subtle dark:border-neutral-700/60 dark:from-neutral-900 dark:to-neutral-900/50">
          <h2 className="text-lg font-bold text-neutral-950 dark:text-neutral-50">
            See it in action
          </h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Try the interactive demo. Sign a real code snippet with your chosen authorship scenario.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/demo"
              className="inline-flex h-10 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover dark:bg-accent-dark dark:hover:bg-accent"
            >
              Try the Demo
            </Link>
            <Link
              href="/setup"
              className="inline-flex h-10 items-center rounded-md border border-neutral-200 bg-white px-6 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
            >
              Setup Guide
            </Link>
          </div>
        </div>
      </section>

      <footer className="flex justify-center border-t border-neutral-200/60 py-6 dark:border-neutral-700/60">
        <Link
          href="/"
          className="text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
        >
          Back to home
        </Link>
      </footer>
    </main>
  )
}

function AuthorshipCard({
  kind,
  kindLabel,
  humanShare,
  description,
  color,
}: {
  kind: string
  kindLabel: string
  humanShare: string
  description: string
  color: string
}) {
  return (
    <div className="flex flex-col rounded-lg border border-neutral-200/60 bg-white p-5 dark:border-neutral-700/60 dark:bg-neutral-900">
      <div className={`mb-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${color}`}>
        {kind}
      </div>
      <p className="mb-2 flex-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
      <div className="mt-auto space-y-1 rounded-md bg-neutral-50 p-3 dark:bg-neutral-800/50">
        <div className="flex justify-between text-2xs">
          <span className="text-neutral-400">authorship.kind</span>
          <code className="font-mono text-accent dark:text-accent-dark">{kindLabel}</code>
        </div>
        <div className="flex justify-between text-2xs">
          <span className="text-neutral-400">humanShare</span>
          <code className="font-mono text-neutral-600 dark:text-neutral-300">{humanShare}</code>
        </div>
      </div>
    </div>
  )
}

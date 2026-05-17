import type { Metadata } from 'next'
import { getAttestation } from '@/lib/attestation'
import { formatSha } from '@/lib/utils'
import Link from 'next/link'

interface VerifyPageProps {
  params: Promise<{ sha: string }>
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const { sha } = await params
  return {
    title: `Verify ${formatSha(sha)} -- Pedigree`,
    description: `Quick verification for commit ${formatSha(sha)}.`,
  }
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { sha } = await params
  const data = await getAttestation(sha)
  const { predicate, isVerified, commitMeta } = data

  const authorshipLabel =
    predicate.authorship.kind === 'human'
      ? 'Human Only'
      : predicate.authorship.kind === 'ai-assisted'
        ? 'AI-Assisted'
        : 'AI Autonomous'

  const hasApproval = predicate.authorship.humanApprover?.approved === true

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Status badge */}
        <div className="flex flex-col items-center gap-4">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full ${
              isVerified ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
            }`}
          >
            {isVerified ? (
              <svg
                className="h-10 w-10 text-emerald-600 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                className="h-10 w-10 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div className="text-center">
            <p
              className={`text-lg font-bold ${
                isVerified
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {isVerified ? 'Verified' : 'Not Verified'}
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Commit {formatSha(sha)}
            </p>
          </div>
        </div>

        {/* Key facts */}
        <div className="rounded-lg border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-900">
          <FactRow label="Author" value={commitMeta.author} />
          <FactRow label="Authorship" value={authorshipLabel} border />
          {predicate.agent && <FactRow label="Model" value={`${predicate.agent.model}`} border />}
          {predicate.agent && <FactRow label="Tool" value={predicate.agent.tool} border />}
          <FactRow
            label="Approved"
            value={hasApproval ? 'Yes' : 'No'}
            border
            valueColor={
              hasApproval
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }
          />
          <FactRow label="Risk" value={predicate.scope.riskClass} border />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link
            href={`/passport/${sha}`}
            className="flex h-10 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover dark:bg-accent-dark dark:hover:bg-accent"
          >
            View Full Passport
          </Link>
          <Link
            href="/demo"
            className="flex h-10 items-center justify-center rounded-md border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Try Pedigree
          </Link>
        </div>

        {/* Branding */}
        <p className="text-center text-2xs text-neutral-400 dark:text-neutral-500">
          Verified by Pedigree, cryptographic provenance for AI code
        </p>
      </div>
    </main>
  )
}

function FactRow({
  label,
  value,
  border,
  valueColor,
}: {
  label: string
  value: string
  border?: boolean
  valueColor?: string
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 ${
        border ? 'border-t border-neutral-200/60 dark:border-neutral-700/60' : ''
      }`}
    >
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
      <span
        className={`text-xs font-semibold ${
          valueColor ?? 'text-neutral-900 dark:text-neutral-100'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

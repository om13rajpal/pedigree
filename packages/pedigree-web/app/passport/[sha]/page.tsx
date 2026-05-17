/** Passport page rendering a commit's full chain of custody and attestation. */

import type { Metadata } from 'next'
import { getAttestation } from '@/lib/attestation'
import { formatSha } from '@/lib/utils'
import { PassportCard } from '@/components/passport/PassportCard'
import { ChainOfCustody } from '@/components/passport/ChainOfCustody'
import { PredicateInspector } from '@/components/passport/PredicateInspector'
import { QRCode } from '@/components/passport/QRCode'
import { RekorLink } from '@/components/passport/RekorLink'

/**
 * Dynamic route parameters for the Passport page.
 */
interface PassportPageProps {
  params: Promise<{
    /** The git commit SHA identifying the attested commit. */
    sha: string
  }>
}

/**
 * Generates dynamic metadata for the Passport page based on the commit SHA.
 *
 * Includes the short SHA in the title and a descriptive summary
 * for link previews and search engines.
 *
 * @param params - The dynamic route params containing the commit SHA.
 * @returns Metadata with title and description including the SHA.
 */
export async function generateMetadata({ params }: PassportPageProps): Promise<Metadata> {
  const { sha } = await params
  const shortSha = formatSha(sha)

  return {
    title: `Passport ${shortSha} -- Pedigree`,
    description: `Chain of custody and AI authorship attestation for commit ${shortSha}. Verified via Sigstore and the Rekor transparency log.`,
  }
}

/**
 * The Passport page: the money page of the Pedigree product.
 *
 * Fetches attestation data for the commit identified by the route SHA,
 * then renders the full chain of custody visualization:
 * 1. PassportCard hero with commit identity and BorderBeam highlight
 * 2. ChainOfCustody vertical timeline with staggered step reveals
 * 3. PredicateInspector collapsible JSON viewer
 * 4. QRCode scaled in from center for mobile verification
 * 5. RekorLink to the transparency log entry
 *
 * This is a server component; child components that need interactivity
 * are marked 'use client' individually.
 *
 * @param params - The dynamic route params containing the commit SHA.
 */
export default async function PassportPage({ params }: PassportPageProps) {
  const { sha } = await params
  const data = await getAttestation(sha)

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-6 py-12">
      {/* Hero: Passport card with border beam */}
      <PassportCard data={data} source={data.source} />

      {/* Chain of custody timeline */}
      <ChainOfCustody data={data} />

      {/* Raw predicate inspector */}
      <PredicateInspector predicate={data.predicate} />

      {/* QR code for mobile verification */}
      <div className="flex justify-center py-4">
        <QRCode sha={sha} />
      </div>

      {/* Rekor transparency log link — only shown for real entries */}
      {data.rekorEntryUrl && !data.rekorEntryUrl.includes('logIndex=0') && (
        <div className="flex justify-center border-t border-neutral-200/60 pt-6 dark:border-neutral-700/60">
          <RekorLink href={data.rekorEntryUrl} />
        </div>
      )}

      {/* Footer link */}
      <footer className="flex justify-center pb-8">
        <a
          href="/"
          className="text-2xs text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
        >
          How Pedigree works
        </a>
      </footer>
    </main>
  )
}

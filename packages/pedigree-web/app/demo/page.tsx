import type { Metadata } from 'next'
import { DemoGallery } from '@/components/demo/DemoGallery'
import { CodePlayground } from '@/components/demo/CodePlayground'
import { ShaLookup } from '@/components/demo/ShaLookup'

export const metadata: Metadata = {
  title: 'Try Pedigree -- Live Demo',
  description:
    'Explore real cryptographically signed Code Passports. Enter any commit SHA or browse pre-attested examples.',
}

export default function DemoPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-16 px-6 py-12">
      <header className="space-y-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-3xl">
          Try Pedigree
        </h1>
        <p className="mx-auto max-w-lg text-sm text-neutral-600 dark:text-neutral-400">
          Every commit below was signed with an ed25519 keypair, wrapped in a DSSE envelope, and
          stored in git attestation refs. Click any commit to see its Code Passport with real
          cryptographic verification.
        </p>
      </header>

      <DemoGallery />

      <CodePlayground />

      <section className="space-y-4">
        <h2 className="text-center text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          Look up any commit
        </h2>
        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
          Paste a full 40-character SHA from this repo. If it has a signed attestation, you will see
          real verified data with a Live badge.
        </p>
        <ShaLookup />
      </section>

      <footer className="flex justify-center border-t border-neutral-200/60 pt-6 dark:border-neutral-700/60">
        <a
          href="/"
          className="text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
        >
          Back to home
        </a>
      </footer>
    </main>
  )
}

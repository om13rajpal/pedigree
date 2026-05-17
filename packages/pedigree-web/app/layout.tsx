/** Root layout providing fonts, metadata, global styles, and navbar. */
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Fraunces } from 'next/font/google'
import { Navbar } from '@/components/Navbar'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-fraunces',
  display: 'swap',
})

/** Site-wide metadata for SEO and social sharing. */
export const metadata: Metadata = {
  title: 'Pedigree -- Code Passport for AI Commits',
  description:
    'Cryptographic provenance layer for AI-written code. Every AI commit gets a signed attestation -- C2PA for source code.',
  keywords: [
    'AI provenance',
    'code attestation',
    'in-toto',
    'Sigstore',
    'AI compliance',
    'EU AI Act',
  ],
}

/**
 * Root layout wrapping all pages with font variables and base structure.
 *
 * @param children - The page content rendered by Next.js routing.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen pt-14 font-sans antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  )
}

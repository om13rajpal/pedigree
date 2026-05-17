/** Landing page composing all sections of the Pedigree marketing site. */

import { HeroSection } from '@/components/landing/HeroSection'
import { StatSlabs } from '@/components/landing/StatSlabs'
import { ArchitectureFlow } from '@/components/landing/ArchitectureFlow'
import { PredicateSpecCard } from '@/components/landing/PredicateSpecCard'
import { CallToAction } from '@/components/landing/CallToAction'
import { Footer } from '@/components/landing/Footer'

/**
 * Landing page for the Pedigree marketing site.
 *
 * Renders the full-page experience in section order: hero with passport
 * preview, stat slabs, architecture flow (the hero moment), predicate
 * spec card, CTA, and footer. Each section manages its own scroll-driven
 * animations and reduced-motion handling.
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <HeroSection />
      <StatSlabs />
      <ArchitectureFlow />
      <PredicateSpecCard />
      <CallToAction />
      <Footer />
    </main>
  )
}

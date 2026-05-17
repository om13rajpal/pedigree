/** Loading skeleton matching the Passport page layout structure. */

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Suspense fallback for the Passport page.
 *
 * Renders skeletons matching the PassportCard, ChainOfCustody timeline,
 * PredicateInspector toggle, and QR code areas so the page does not
 * shift when real data arrives.
 */
export default function PassportLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-6 py-12">
      {/* PassportCard skeleton */}
      <div className="space-y-4 rounded-lg border border-neutral-200/60 bg-white p-6 shadow-subtle dark:border-neutral-700/60 dark:bg-neutral-900">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-sm" />
            <Skeleton className="h-5 w-20 rounded-sm" />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="space-y-2 border-t border-neutral-200/60 pt-4 dark:border-neutral-700/60">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Chain of custody skeleton */}
      <div className="space-y-1">
        <Skeleton className="mb-4 h-4 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 pb-6">
            <div className="flex flex-col items-center">
              <Skeleton className="h-8 w-8 rounded-full" />
              {i < 4 && <Skeleton className="mt-1 h-12 w-px" />}
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>

      {/* Predicate inspector toggle skeleton */}
      <Skeleton className="h-8 w-full" />

      {/* QR code skeleton */}
      <div className="flex justify-center py-4">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-48 w-48 rounded-lg" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Rekor link skeleton */}
      <div className="flex justify-center border-t border-neutral-200/60 pt-6 dark:border-neutral-700/60">
        <Skeleton className="h-4 w-48" />
      </div>
    </main>
  )
}

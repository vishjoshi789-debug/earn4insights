'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Session-aware landing-page primary CTAs.
 *
 * For logged-OUT visitors these are the signup/conversion buttons. Once a
 * user is authenticated they collapse to a single "Go to Dashboard" — so a
 * logged-in person isn't shown a misleading "Get Started Free" that the
 * middleware would just bounce to /dashboard anyway (and which, for a
 * single-role account, would land them somewhere unrelated to the section
 * they clicked). The landing page stays a static server component; only
 * these buttons are client-side.
 *
 * During session load we render the logged-out variant (the common case +
 * avoids a layout placeholder); it swaps to "Go to Dashboard" once auth
 * resolves.
 */

/** Hero: three role buttons when logged out, one "Go to Dashboard" when in. */
export function HeroCtas() {
  const { status } = useSession()

  if (status === 'authenticated') {
    return (
      <div className="mt-10 flex justify-center">
        <Button size="lg" asChild className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Link href="/dashboard">
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
      <Button size="lg" asChild className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto">
        <Link href="/signup?role=brand">
          I&apos;m a Brand
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <Button size="lg" asChild className="gap-2 bg-accent hover:bg-accent/90 w-full sm:w-auto">
        <Link href="/signup?role=consumer">
          I&apos;m a Consumer
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <Button size="lg" asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white w-full sm:w-auto">
        <Link href="/signup?role=influencer">
          I&apos;m an Influencer
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}

/**
 * A single section/footer primary CTA. Logged out → the given signup label +
 * role; logged in → "Go to Dashboard". `className` carries the per-section
 * brand colour so each section keeps its own button styling.
 */
export function SectionCta({
  role,
  label,
  className,
}: {
  role?: 'brand' | 'consumer' | 'influencer'
  label: string
  className?: string
}) {
  const { status } = useSession()
  const loggedIn = status === 'authenticated'
  const href = loggedIn ? '/dashboard' : role ? `/signup?role=${role}` : '/signup'
  return (
    <Button size="lg" asChild className={className}>
      <Link href={href}>
        {loggedIn ? 'Go to Dashboard' : label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  )
}

'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Sparkles, ArrowRight, Check } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * 3.5F — Cross-role upgrade entry point.
 *
 * Shown on /dashboard/settings for users who are currently a Consumer
 * (or other non-influencer primary role) AND haven't already opted
 * into the influencer flag. Click → /onboarding?path=influencer which
 * routes to the 3.5C InfluencerOnboardingClient regardless of the
 * user's primary role.
 *
 * After wizard completion:
 *   - users.is_influencer is flipped to true server-side
 *   - users.role STAYS as the original (e.g. 'consumer')
 *   - User is dual-role; RoleSwitcher (3.5E) becomes visible after
 *     they re-sign-in to mint a fresh JWT carrying the new flag
 *
 * Hidden when:
 *   - User is already an influencer (isInfluencer flag set)
 *   - User is a brand (brands don't typically pivot to influencer
 *     via this surface; their flow is different)
 *   - User is admin (no upgrade meaningful)
 */
export function BecomeInfluencerCard() {
  const { data: session } = useSession()
  if (!session?.user) return null

  const u = session.user as {
    role?: string
    isBrand?: boolean
    isConsumer?: boolean
    isInfluencer?: boolean
  }

  // Hide for users who already have influencer access.
  if (u.isInfluencer) return null
  // Hide for brand-primary and admin users.
  if (u.role === 'brand' || u.role === 'admin') return null

  return (
    <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-pink-500/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          Become an Influencer
        </CardTitle>
        <CardDescription>
          Unlock brand campaigns and earn from your reach. Takes ~3 minutes
          to set up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
            <span>Apply to brand campaigns that match your niche</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
            <span>Get paid in INR via bank, UPI, or international transfer</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
            <span>Your Consumer account stays — you can switch between views anytime</span>
          </li>
        </ul>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button asChild className="bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white">
            <Link href="/onboarding?path=influencer">
              Set up Influencer profile <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/help" prefetch={false}>
              Learn more
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

import Link from 'next/link'
import { ArrowRight, Sparkles, ShieldAlert, Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * ER.2 — Friendly card shown at the top of /dashboard after the
 * influencer/brand layout guards redirect a non-authorized user back
 * with `?upgrade=influencer` or `?upgrade=brand`.
 *
 * Two variants:
 *
 *   influencer → "Become an Influencer" upgrade flow
 *                Primary CTA: /onboarding?path=influencer
 *                Conversion-oriented — many consumers may convert
 *                via this prompt after discovering a locked feature.
 *
 *   brand      → "Brand Account Required" hard stop
 *                Primary CTA: mailto:hello@earn4insights.com
 *                No auto-upgrade — brand accounts require business
 *                verification + billing setup.
 *
 * Server component (no client state needed). The card itself doesn't
 * dismiss — the user clears the prompt by either taking the CTA or
 * navigating back to /dashboard (which strips the ?upgrade= param).
 */

type Variant = 'influencer' | 'brand'

const COPY: Record<
  Variant,
  {
    icon: typeof Sparkles
    iconColor: string
    iconBg: string
    title: string
    body: string
    primaryHref: string
    primaryLabel: string
    primaryIcon: typeof ArrowRight
  }
> = {
  influencer: {
    icon: Sparkles,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
    title: 'Become an Influencer',
    body: 'This feature is available to influencers. Apply to brand campaigns, earn from your audience, and unlock marketplace opportunities.',
    primaryHref: '/onboarding?path=influencer',
    primaryLabel: 'Become an influencer',
    primaryIcon: ArrowRight,
  },
  brand: {
    icon: ShieldAlert,
    iconColor: 'text-destructive',
    iconBg: 'bg-destructive/10',
    title: 'Brand Account Required',
    body: 'This feature is for brand accounts only. Brand accounts include campaign management, analytics, and direct influencer connections.',
    primaryHref: 'mailto:hello@earn4insights.com?subject=Brand%20account%20access',
    primaryLabel: 'Contact us about brand access',
    primaryIcon: Mail,
  },
}

export function UpgradePromptCard({ variant }: { variant: Variant }) {
  const copy = COPY[variant]
  const Icon = copy.icon
  const PrimaryIcon = copy.primaryIcon

  return (
    <div
      role="region"
      aria-label={copy.title}
      className="rounded-xl border border-border bg-card p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-5 items-start"
    >
      <div
        className={`h-12 w-12 rounded-full ${copy.iconBg} flex items-center justify-center shrink-0`}
      >
        <Icon className={`h-5 w-5 ${copy.iconColor}`} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            {copy.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {copy.body}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button asChild size="sm" className="h-9">
            <Link href={copy.primaryHref}>
              <PrimaryIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {copy.primaryLabel}
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-9 text-muted-foreground">
            <Link href="/dashboard">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { FeatureAdoption } from '@/lib/types/platformAnalytics'

interface Props {
  features: FeatureAdoption[]
}

/**
 * Feature × role usage heatmap.
 *
 * Numerator: distinct users who touched the feature in the selected window.
 * Denominator: latest per-role DAU (today's active brands / consumers /
 * influencers). Documented as a known approximation in CLAUDE.md — true
 * "active in window" would need a parallel role-split MAU column.
 *
 * Some features only make sense for one role (e.g. ICP / Competitive
 * Intel are brand-only; DSAR is consumer-only). Those cells render as
 * '—' instead of '0%' so the table doesn't penalise correct behaviour.
 */

const FEATURE_LABELS: Record<string, { label: string; brand: boolean; consumer: boolean; influencer: boolean }> = {
  feedback: { label: 'Feedback submitted', brand: false, consumer: true, influencer: true },
  surveys: { label: 'Surveys answered', brand: false, consumer: true, influencer: true },
  deals: { label: 'Deals redeemed', brand: false, consumer: true, influencer: true },
  community: { label: 'Community posts', brand: true, consumer: true, influencer: true },
  campaigns: { label: 'Campaigns created', brand: true, consumer: false, influencer: false },
  icp: { label: 'ICP defined', brand: true, consumer: false, influencer: false },
  competitive_intel: { label: 'Competitive intel', brand: true, consumer: false, influencer: false },
  social_hub: { label: 'Social hub connected', brand: false, consumer: true, influencer: true },
  dsar: { label: 'DSAR requested', brand: false, consumer: true, influencer: true },
  support_chat: { label: 'Support chat used', brand: true, consumer: true, influencer: true },
}

// Order rows so brand-only and shared come first, then consumer-only.
const FEATURE_ORDER: string[] = [
  'campaigns', 'icp', 'competitive_intel',
  'feedback', 'surveys', 'deals', 'community',
  'social_hub', 'support_chat', 'dsar',
]

function heatColor(pct: number | null, applicable: boolean): string {
  if (!applicable) return 'bg-muted/20 text-muted-foreground/60'
  if (pct == null || pct === 0) return 'bg-muted/30 text-muted-foreground'
  if (pct >= 70) return 'bg-indigo-600/90 text-white'
  if (pct >= 50) return 'bg-indigo-500/70 text-white'
  if (pct >= 30) return 'bg-indigo-400/55 text-foreground'
  if (pct >= 15) return 'bg-indigo-300/40 text-foreground'
  return 'bg-indigo-200/25 text-foreground'
}

function cellText(pct: number | null, applicable: boolean): string {
  if (!applicable) return '—'
  if (pct == null) return '—'
  return `${pct.toFixed(0)}%`
}

export function FeatureAdoptionMap({ features }: Props) {
  // Build a lookup so we can render in our fixed order even if backend skipped one.
  const byFeature = new Map(features.map((f) => [f.feature, f]))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Feature adoption</CardTitle>
        <p className="text-[11px] text-muted-foreground pt-1">
          % of role's active users who touched the feature in the selected window. &lsquo;—&rsquo; means
          either the role doesn&apos;t have access to that feature, or no signal yet.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">Feature</th>
                <th className="text-center font-medium px-2 py-2 min-w-[80px]">Brands</th>
                <th className="text-center font-medium px-2 py-2 min-w-[80px]">Consumers</th>
                <th className="text-center font-medium px-2 py-2 min-w-[80px]">Influencers</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ORDER.map((key) => {
                const meta = FEATURE_LABELS[key]
                if (!meta) return null
                const row = byFeature.get(key)
                return (
                  <tr key={key} className="border-t border-border/50">
                    <td className="px-3 py-2 text-foreground whitespace-nowrap">{meta.label}</td>
                    {(['brand', 'consumer', 'influencer'] as const).map((roleKey) => {
                      const applicable = meta[roleKey]
                      const pct =
                        roleKey === 'brand' ? row?.brandPct ?? null :
                        roleKey === 'consumer' ? row?.consumerPct ?? null :
                        row?.influencerPct ?? null
                      return (
                        <td key={roleKey} className="px-1 py-1">
                          <div
                            className={cn(
                              'rounded-sm text-center tabular-nums px-1 py-1.5 text-[11px]',
                              heatColor(pct, applicable),
                            )}
                          >
                            {cellText(pct, applicable)}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

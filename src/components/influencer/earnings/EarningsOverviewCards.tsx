'use client'

import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Clock, CalendarDays, Megaphone, Target, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface Aggregate {
  currency: string
  released: number
  escrowed: number
  pending: number
  refunded: number
  thisMonth: number
}

interface EarningsOverviewCardsProps {
  aggregates: Aggregate[]
  activeCampaigns: number
  engagementRate: number
  icpMatchRate: number
  loading?: boolean
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="h-4 w-20 bg-muted rounded animate-pulse mb-2" />
        <div className="h-7 w-28 bg-muted rounded animate-pulse mb-1" />
        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

function formatMultiCurrency(aggregates: Aggregate[], field: keyof Omit<Aggregate, 'currency'>): string {
  if (aggregates.length === 0) return formatCurrency(0, 'INR')
  if (aggregates.length === 1) return formatCurrency(aggregates[0][field], aggregates[0].currency)

  // Sort by amount descending, show primary + count
  const sorted = [...aggregates].sort((a, b) => b[field] - a[field])
  const primary = formatCurrency(sorted[0][field], sorted[0].currency)
  return aggregates.length > 1 ? `${primary} +${aggregates.length - 1} more` : primary
}

function sumField(aggregates: Aggregate[], field: keyof Omit<Aggregate, 'currency'>): string {
  return formatMultiCurrency(aggregates, field)
}

export function EarningsOverviewCards({
  aggregates,
  activeCampaigns,
  engagementRate,
  icpMatchRate,
  loading,
}: EarningsOverviewCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const cards = [
    {
      label: 'Total Earned',
      value: sumField(aggregates, 'released'),
      sub: 'All-time released',
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      label: 'Pending Balance',
      value: sumField(aggregates, 'escrowed'),
      sub: 'Held in escrow',
      icon: Clock,
      color: 'text-blue-600',
    },
    {
      label: 'This Month',
      value: sumField(aggregates, 'thisMonth'),
      sub: 'Released this month',
      icon: CalendarDays,
      color: 'text-purple-600',
    },
    {
      label: 'Active Campaigns',
      value: String(activeCampaigns),
      sub: 'Currently active',
      icon: Megaphone,
      color: 'text-orange-600',
    },
    {
      label: 'ICP Match Rate',
      value: `${icpMatchRate.toFixed(1)}%`,
      sub: 'Viewers matching ICPs',
      icon: Target,
      color: icpMatchRate >= 60 ? 'text-green-600' : icpMatchRate >= 30 ? 'text-yellow-600' : 'text-red-600',
    },
    {
      label: 'Engagement Rate',
      value: `${engagementRate.toFixed(1)}%`,
      sub: 'Likes+comments+shares/views',
      icon: TrendingUp,
      color: engagementRate >= 5 ? 'text-green-600' : engagementRate >= 2 ? 'text-yellow-600' : 'text-red-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map(card => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
            </div>
            <p className="text-lg font-bold truncate">{card.value}</p>
            <p className="text-[11px] text-muted-foreground">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

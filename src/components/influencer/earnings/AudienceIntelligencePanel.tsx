'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, Info } from 'lucide-react'
import {
  GaugeCard,
  BarChartCard,
  DonutChartCard,
  HorizontalBarChartCard,
  PlaceholderChart,
} from './PerformanceCharts'

interface AudienceAnalytics {
  totalMatched: number
  cohortMet: boolean
  icpMatchRate: number
  geography: Array<{ name: string; count: number }>
  ageDistribution: Array<{ range: string; count: number }>
  genderSplit: Array<{ gender: string; count: number }>
  topInterests: Array<{ category: string; count: number }>
  engagementTiers: Array<{ tier: string; count: number }>
  deviceBreakdown: Array<{ device: string; count: number }>
  peakHours: Array<{ hour: number; engagement: number }>
}

interface AudienceIntelligencePanelProps {
  analytics: AudienceAnalytics | null
  loading?: boolean
}

function SkeletonPanel() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-48 bg-muted rounded animate-pulse" />
        <div className="h-3 w-64 bg-muted rounded animate-pulse mt-1" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[250px] bg-muted rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function AudienceIntelligencePanel({ analytics, loading }: AudienceIntelligencePanelProps) {
  if (loading) return <SkeletonPanel />

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Audience Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No audience data available. Complete campaigns with ICP-linked brands to see analytics.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!analytics.cohortMet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Audience Intelligence
          </CardTitle>
          <CardDescription>Based on ICP-matched audience profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Privacy threshold not met
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                Fewer than 5 ICP-matched consumers with active demographic consent.
                Demographics are hidden to prevent re-identification.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <GaugeCard
              title="ICP Match Rate"
              value={analytics.icpMatchRate}
              label={`${analytics.totalMatched} matched consumer${analytics.totalMatched !== 1 ? 's' : ''}`}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Audience Intelligence
        </CardTitle>
        <CardDescription>
          Based on ICP-matched audience profile ({analytics.totalMatched} consumers with active consent)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* ICP Match Rate Gauge */}
          <GaugeCard
            title="ICP Match Rate"
            value={analytics.icpMatchRate}
            label={`${analytics.icpMatchRate.toFixed(1)}% of viewers match brand ICPs`}
          />

          {/* Geography */}
          <BarChartCard
            title="Top Locations"
            data={analytics.geography.slice(0, 5).map(g => ({ name: g.name, value: g.count }))}
          />

          {/* Age Distribution */}
          <BarChartCard
            title="Age Distribution"
            data={analytics.ageDistribution.map(a => ({ name: a.range, value: a.count }))}
            color="#3b82f6"
          />

          {/* Gender Split */}
          <DonutChartCard
            title="Gender Split"
            data={analytics.genderSplit.map(g => ({ name: g.gender, value: g.count }))}
          />

          {/* Top Interests */}
          <HorizontalBarChartCard
            title="Top Interest Categories"
            data={analytics.topInterests.slice(0, 8).map(i => ({ name: i.category, value: i.count }))}
            color="#10b981"
          />

          {/* Engagement Tiers */}
          <DonutChartCard
            title="Engagement Tiers"
            data={analytics.engagementTiers.map(t => ({ name: t.tier, value: t.count }))}
          />

          {/* Device Breakdown — placeholder */}
          <PlaceholderChart
            title="Device Breakdown"
            message="Viewer-level tracking coming soon"
          />

          {/* Peak Hours — placeholder */}
          <PlaceholderChart
            title="Best Performing Hours"
            message="Hour-level performance data coming soon"
          />
        </div>
      </CardContent>
    </Card>
  )
}

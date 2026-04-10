'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, Loader2, Eye, Heart, MessageSquare, Share2, Bookmark, MousePointerClick, Radio, Target } from 'lucide-react'
import { LineChartCard } from './PerformanceCharts'
import { formatCurrency } from '@/lib/currency'

interface CampaignDeepDiveProps {
  campaignId: string
  onClose: () => void
}

interface DeepDiveData {
  campaign: {
    id: string
    title: string
    brandName: string | null
    status: string
    budgetTotal: number
    budgetCurrency: string
    startDate: string | null
    endDate: string | null
    targetPlatforms: string[]
  }
  totals: {
    views: number
    likes: number
    comments: number
    shares: number
    saves: number
    clicks: number
    reach: number
    impressions: number
    icpMatchedViewers: number
    engagementRate: number
    icpMatchRate: number
  }
  timeSeries: Array<{
    metricDate: string
    platform: string
    views: number
    likes: number
    comments: number
    shares: number
  }>
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  proposed: 'bg-blue-100 text-blue-800',
  negotiating: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
  disputed: 'bg-orange-100 text-orange-800',
}

export function CampaignDeepDive({ campaignId, onClose }: CampaignDeepDiveProps) {
  const [data, setData] = useState<DeepDiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/influencer/earnings/${campaignId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load campaign data')
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [campaignId])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Campaign Details</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error ?? 'Campaign not found'}</p>
        </CardContent>
      </Card>
    )
  }

  const { campaign, totals, timeSeries } = data

  // Aggregate time series by date for charts
  const dailyMap = new Map<string, { views: number; engagement: number }>()
  for (const row of timeSeries) {
    const existing = dailyMap.get(row.metricDate) ?? { views: 0, engagement: 0 }
    existing.views += row.views
    existing.engagement += row.likes + row.comments + row.shares
    dailyMap.set(row.metricDate, existing)
  }
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      views: vals.views,
      engagement: vals.engagement,
    }))

  const metricCards = [
    { label: 'Views', value: totals.views, icon: Eye },
    { label: 'Likes', value: totals.likes, icon: Heart },
    { label: 'Comments', value: totals.comments, icon: MessageSquare },
    { label: 'Shares', value: totals.shares, icon: Share2 },
    { label: 'Saves', value: totals.saves, icon: Bookmark },
    { label: 'Clicks', value: totals.clicks, icon: MousePointerClick },
    { label: 'Reach', value: totals.reach, icon: Radio },
    { label: 'Impressions', value: totals.impressions, icon: Eye },
    { label: 'ICP Matched', value: totals.icpMatchedViewers, icon: Target },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{campaign.title}</CardTitle>
          <CardDescription className="flex items-center gap-2 flex-wrap">
            {campaign.brandName && <span>{campaign.brandName}</span>}
            <Badge variant="secondary" className={STATUS_COLORS[campaign.status] ?? ''}>
              {campaign.status}
            </Badge>
            {campaign.startDate && campaign.endDate && (
              <span className="text-xs">
                {new Date(campaign.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' — '}
                {new Date(campaign.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            <span className="text-xs">
              Budget: {formatCurrency(campaign.budgetTotal, campaign.budgetCurrency)}
            </span>
          </CardDescription>
          {campaign.targetPlatforms.length > 0 && (
            <div className="flex gap-1 mt-1">
              {campaign.targetPlatforms.map(p => (
                <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">{p}</Badge>
              ))}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key rates */}
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Engagement Rate</p>
            <p className="text-xl font-bold">{totals.engagementRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ICP Match Rate</p>
            <p className="text-xl font-bold">{totals.icpMatchRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {metricCards.map(m => (
            <div key={m.label} className="rounded-md border p-2.5 text-center">
              <m.icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-semibold">{m.value.toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Time series charts */}
        {dailyData.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LineChartCard
              title="Daily Views"
              data={dailyData}
              lines={[{ key: 'views', color: '#8b5cf6', label: 'Views' }]}
              xKey="date"
              height={200}
            />
            <LineChartCard
              title="Daily Engagement"
              data={dailyData}
              lines={[{ key: 'engagement', color: '#10b981', label: 'Likes+Comments+Shares' }]}
              xKey="date"
              height={200}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

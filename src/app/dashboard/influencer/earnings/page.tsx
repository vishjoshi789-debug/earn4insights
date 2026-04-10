'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Wallet } from 'lucide-react'
import { EarningsOverviewCards } from '@/components/influencer/earnings/EarningsOverviewCards'
import { EarningsTable } from '@/components/influencer/earnings/EarningsTable'
import { PaymentBreakdown } from '@/components/influencer/earnings/PaymentBreakdown'
import { AudienceIntelligencePanel } from '@/components/influencer/earnings/AudienceIntelligencePanel'
import { CampaignDeepDive } from '@/components/influencer/earnings/CampaignDeepDive'

interface EarningsData {
  aggregates: Array<{
    currency: string
    released: number
    escrowed: number
    pending: number
    refunded: number
    thisMonth: number
  }>
  activeCampaigns: number
  engagementRate: number
  icpMatchRate: number
  performance: Record<string, number>
  payments: Array<{
    id: string
    campaignId: string
    campaignTitle: string
    brandId: string
    productId: string | null
    milestoneId: string | null
    milestoneTitle: string | null
    amount: number
    currency: string
    paymentType: string
    status: string
    platformFee: number
    escrowedAt: string | null
    releasedAt: string | null
    refundedAt: string | null
    createdAt: string
  }>
}

interface AnalyticsData {
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

export default function InfluencerEarningsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [earnings, setEarnings] = useState<EarningsData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [earningsLoading, setEarningsLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/influencer/earnings')
      .then(r => r.ok ? r.json() : null)
      .then(data => setEarnings(data))
      .finally(() => setEarningsLoading(false))

    fetch('/api/influencer/earnings/analytics')
      .then(r => r.ok ? r.json() : null)
      .then(data => setAnalytics(data))
      .finally(() => setAnalyticsLoading(false))
  }, [status])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          Earnings Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your campaign earnings, payment status, and audience insights.
        </p>
      </div>

      {/* Overview Cards */}
      <EarningsOverviewCards
        aggregates={earnings?.aggregates ?? []}
        activeCampaigns={earnings?.activeCampaigns ?? 0}
        engagementRate={earnings?.engagementRate ?? 0}
        icpMatchRate={earnings?.icpMatchRate ?? 0}
        loading={earningsLoading}
      />

      {/* Main content: Table + Payment Breakdown */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EarningsTable
            payments={earnings?.payments ?? []}
            loading={earningsLoading}
            onCampaignClick={setSelectedCampaignId}
          />
        </div>
        <div>
          <PaymentBreakdown
            aggregates={earnings?.aggregates ?? []}
            loading={earningsLoading}
          />
        </div>
      </div>

      {/* Campaign Deep Dive (shown when a campaign is selected) */}
      {selectedCampaignId && (
        <CampaignDeepDive
          campaignId={selectedCampaignId}
          onClose={() => setSelectedCampaignId(null)}
        />
      )}

      {/* Audience Intelligence */}
      <AudienceIntelligencePanel
        analytics={analytics}
        loading={analyticsLoading}
      />
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Store, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import CampaignCard from '@/components/influencer/marketplace/CampaignCard'
import CampaignDetailPanel from '@/components/influencer/marketplace/CampaignDetailPanel'
import ApplicationsTracker from '@/components/influencer/marketplace/ApplicationsTracker'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'budget_high', label: 'Budget High-Low' },
  { value: 'budget_low', label: 'Budget Low-High' },
  { value: 'deadline_soon', label: 'Deadline Soon' },
]

const PLATFORMS = ['Instagram', 'YouTube', 'Twitter', 'LinkedIn', 'TikTok']

export default function MarketplacePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Data
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [recommended, setRecommended] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [recLoading, setRecLoading] = useState(true)

  // Filters
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('newest')
  const [platform, setPlatform] = useState('')
  const [minBudget, setMinBudget] = useState('')
  const [maxBudget, setMaxBudget] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Detail panel
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  // Tab
  const [activeTab, setActiveTab] = useState('browse')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  // Load recommended
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/marketplace/campaigns/recommended')
      .then(r => r.json())
      .then(d => setRecommended(d.campaigns ?? []))
      .catch(() => {})
      .finally(() => setRecLoading(false))
  }, [status])

  // Load campaigns
  const loadCampaigns = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), sortBy })
    if (platform) params.set('platform', platform.toLowerCase())
    if (minBudget) params.set('minBudget', String(Math.round(parseFloat(minBudget) * 100)))
    if (maxBudget) params.set('maxBudget', String(Math.round(parseFloat(maxBudget) * 100)))

    fetch(`/api/marketplace/campaigns?${params}`)
      .then(r => r.json())
      .then(d => {
        setCampaigns(d.campaigns ?? [])
        setTotal(d.total ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, sortBy, platform, minBudget, maxBudget])

  useEffect(() => {
    if (status === 'authenticated') loadCampaigns()
  }, [status, loadCampaigns])

  const clearFilters = () => {
    setPlatform('')
    setMinBudget('')
    setMaxBudget('')
    setPage(1)
  }

  const totalPages = Math.ceil(total / 12)
  const hasFilters = !!(platform || minBudget || maxBudget)

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <Store className="h-6 w-6" />
          Campaign Marketplace
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover brand campaigns and apply with your proposal.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">Browse Campaigns</TabsTrigger>
          <TabsTrigger value="applications">My Applications</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-4 space-y-6">

          {/* Recommended */}
          {!recLoading && recommended.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2">Recommended for You</h2>
              <p className="text-[11px] text-muted-foreground mb-3">Based on your niche and profile</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommended.map(c => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    onViewDetails={setSelectedCampaignId}
                    onApply={setSelectedCampaignId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Toolbar: sort + filter toggle */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">{total} campaign{total !== 1 ? 's' : ''} found</p>
            <div className="flex items-center gap-2">
              <select
                className="border rounded px-3 py-1.5 text-sm bg-background text-foreground"
                value={sortBy}
                onChange={e => { setSortBy(e.target.value); setPage(1) }}
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button
                size="sm"
                variant={filtersOpen ? 'default' : 'outline'}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                Filters
                {hasFilters && <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">!</Badge>}
              </Button>
              {hasFilters && (
                <Button size="sm" variant="ghost" className="text-xs" onClick={clearFilters}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          {/* Filters panel */}
          {filtersOpen && (
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Platform</Label>
                    <select
                      className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
                      value={platform}
                      onChange={e => { setPlatform(e.target.value); setPage(1) }}
                    >
                      <option value="">All Platforms</option>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Min Budget</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={minBudget}
                      onChange={e => { setMinBudget(e.target.value); setPage(1) }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Budget</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={maxBudget}
                      onChange={e => { setMaxBudget(e.target.value); setPage(1) }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaign grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-4 space-y-3">
                    <div className="h-3 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-8 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <Store className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">No campaigns found</p>
                <p className="text-xs text-muted-foreground">
                  {hasFilters ? 'Try adjusting your filters.' : 'Check back later for new opportunities.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {campaigns.map(c => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onViewDetails={setSelectedCampaignId}
                  onApply={setSelectedCampaignId}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

        </TabsContent>

        <TabsContent value="applications" className="mt-4">
          <ApplicationsTracker onViewCampaign={(id) => { setActiveTab('browse'); setSelectedCampaignId(id) }} />
        </TabsContent>
      </Tabs>

      {/* Detail slide-out */}
      {selectedCampaignId && (
        <CampaignDetailPanel
          campaignId={selectedCampaignId}
          onClose={() => setSelectedCampaignId(null)}
          onApplicationChange={loadCampaigns}
        />
      )}
    </div>
  )
}

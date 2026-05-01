'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Search, Tag, Clock, TrendingUp, Star, Flame, Bookmark,
  BookmarkCheck, ExternalLink, Copy, Check, Loader2, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────

type Deal = {
  id: string
  brandId: string
  title: string
  description: string
  dealType: string
  discountValue: string | null
  discountCurrency: string
  promoCode: string | null
  redirectUrl: string | null
  originalPrice: number | null
  discountedPrice: number | null
  maxRedemptions: number | null
  redemptionCount: number
  validFrom: string
  validUntil: string | null
  category: string | null
  tags: string[]
  status: string
  isFeatured: boolean
  isVerified: boolean
  viewCount: number
  saveCount: number
  createdAt: string
  isSaved?: boolean
  isRedeemed?: boolean
}

type FeedData = {
  featured: Deal[]
  trending: Deal[]
  expiring: Deal[]
  newest: Deal[]
  mostSaved: Deal[]
  forYou: Deal[]
}

// ── Deal Card ────────────────────────────────────────────────────

function DealCard({ deal, onSave, onRedeem }: {
  deal: Deal
  onSave: (id: string) => void
  onRedeem: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const discount = deal.dealType === 'percentage_off' && deal.discountValue
    ? `${deal.discountValue}% OFF`
    : deal.dealType === 'flat_off' && deal.discountValue
    ? `₹${deal.discountValue} OFF`
    : deal.dealType === 'bogo' ? 'BOGO' : 'DEAL'

  const timeLeft = deal.validUntil
    ? getTimeLeft(deal.validUntil)
    : null

  const handleCopyCode = () => {
    if (deal.promoCode) {
      navigator.clipboard.writeText(deal.promoCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onRedeem(deal.id)
    }
  }

  return (
    <Card className="border-border/60 hover:border-border transition-colors group">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="bg-emerald-900/50 text-emerald-300 text-xs shrink-0">
                {discount}
              </Badge>
              {deal.isFeatured && (
                <Badge variant="secondary" className="bg-amber-900/50 text-amber-300 text-xs">
                  <Star className="h-3 w-3 mr-1" />Featured
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-sm leading-tight line-clamp-2">{deal.title}</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => onSave(deal.id)}
          >
            {deal.isSaved
              ? <BookmarkCheck className="h-4 w-4 text-indigo-400" />
              : <Bookmark className="h-4 w-4 text-muted-foreground" />
            }
          </Button>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">{deal.description}</p>

        {(deal.originalPrice || deal.discountedPrice) && (
          <div className="flex items-center gap-2">
            {deal.originalPrice && (
              <span className="text-xs text-muted-foreground line-through">₹{deal.originalPrice}</span>
            )}
            {deal.discountedPrice && (
              <span className="text-sm font-bold text-emerald-400">₹{deal.discountedPrice}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {deal.category && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />{deal.category}
              </span>
            )}
            {timeLeft && (
              <span className="flex items-center gap-1 text-amber-400">
                <Clock className="h-3 w-3" />{timeLeft}
              </span>
            )}
          </div>
          <span>{deal.redemptionCount} redeemed</span>
        </div>

        {/* Action */}
        {deal.promoCode ? (
          <Button
            size="sm"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={handleCopyCode}
            disabled={deal.isRedeemed && !deal.promoCode}
          >
            {copied ? <><Check className="h-4 w-4 mr-1" />Copied!</>
              : <><Copy className="h-4 w-4 mr-1" />{deal.promoCode}</>}
          </Button>
        ) : deal.redirectUrl ? (
          <Button
            size="sm"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={() => { window.open(deal.redirectUrl!, '_blank'); onRedeem(deal.id) }}
          >
            <ExternalLink className="h-4 w-4 mr-1" />Get Deal
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function DealCardSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}

// ── Horizontal scroll section ────────────────────────────────────

function DealSection({ title, icon, deals, onSave, onRedeem }: {
  title: string
  icon: React.ReactNode
  deals: Deal[]
  onSave: (id: string) => void
  onRedeem: (id: string) => void
}) {
  if (deals.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        {icon}{title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {deals.map(d => (
          <DealCard key={d.id} deal={d} onSave={onSave} onRedeem={onRedeem} />
        ))}
      </div>
    </section>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function getTimeLeft(validUntil: string): string | null {
  const diff = new Date(validUntil).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / 3600_000)
  if (hours < 24) return `${hours}h left`
  const days = Math.floor(hours / 24)
  return `${days}d left`
}

// ── Categories ───────────────────────────────────────────────────

const CATEGORIES = [
  'Electronics', 'Fashion', 'Food & Beverage', 'Health & Beauty',
  'Home & Living', 'Travel', 'Entertainment', 'Education',
  'Finance', 'Sports', 'Automotive', 'Other',
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'most_redeemed', label: 'Most Redeemed' },
  { value: 'most_saved', label: 'Most Saved' },
]

// ── Main Page ────────────────────────────────────────────────────

export default function DealsClient() {
  const [tab, setTab] = useState('discover')
  const [feed, setFeed] = useState<FeedData | null>(null)
  const [searchResults, setSearchResults] = useState<Deal[]>([])
  const [savedDeals, setSavedDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)

  // Search state
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [sort, setSort] = useState('newest')
  const [searchCursor, setSearchCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Load feed
  useEffect(() => {
    fetch('/api/deals/feed')
      .then(r => r.json())
      .then(setFeed)
      .catch(() => toast.error('Failed to load deals'))
      .finally(() => setLoading(false))
  }, [])

  // Search
  const doSearch = useCallback(async (cursor?: string) => {
    setSearchLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (category) params.set('category', category)
      params.set('sort', sort)
      if (cursor) params.set('cursor', cursor)
      params.set('limit', '20')

      const res = await fetch(`/api/deals/search?${params}`)
      const data = await res.json()

      if (cursor) {
        setSearchResults(prev => [...prev, ...data.deals])
      } else {
        setSearchResults(data.deals)
      }
      setSearchCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    } catch {
      toast.error('Search failed')
    } finally {
      setSearchLoading(false)
    }
  }, [query, category, sort])

  // Load saved deals
  const loadSaved = useCallback(async () => {
    try {
      const res = await fetch('/api/deals/saved')
      const data = await res.json()
      setSavedDeals(data.deals ?? [])
    } catch {
      toast.error('Failed to load saved deals')
    }
  }, [])

  useEffect(() => {
    if (tab === 'saved') loadSaved()
  }, [tab, loadSaved])

  // Actions
  const handleSave = async (dealId: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}/save`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.saved ? 'Deal saved' : 'Deal unsaved')

      // Update local state
      const updateDeal = (d: Deal) =>
        d.id === dealId ? { ...d, isSaved: data.saved } : d
      if (feed) {
        setFeed({
          featured: feed.featured.map(updateDeal),
          trending: feed.trending.map(updateDeal),
          expiring: feed.expiring.map(updateDeal),
          newest: feed.newest.map(updateDeal),
          mostSaved: feed.mostSaved.map(updateDeal),
          forYou: feed.forYou.map(updateDeal),
        })
      }
      setSearchResults(prev => prev.map(updateDeal))
    } catch {
      toast.error('Failed to save deal')
    }
  }

  const handleRedeem = async (dealId: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}/redeem`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (!data.alreadyRedeemed) {
        toast.success('+10 points! Deal redeemed')
      }
    } catch {
      // Silent — the code was still copied
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Deals & Offers</h1>
        <p className="text-muted-foreground text-sm">Discover exclusive deals, promo codes, and discounts from top brands</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
        </TabsList>

        {/* ── Discover Tab ────────────────────────────────────── */}
        <TabsContent value="discover" className="space-y-6 mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <DealCardSkeleton key={i} />)}
            </div>
          ) : feed ? (
            <>
              <DealSection title="Featured" icon={<Star className="h-5 w-5 text-amber-400" />} deals={feed.featured} onSave={handleSave} onRedeem={handleRedeem} />
              <DealSection title="Trending" icon={<Flame className="h-5 w-5 text-orange-400" />} deals={feed.trending} onSave={handleSave} onRedeem={handleRedeem} />
              <DealSection title="Expiring Soon" icon={<Clock className="h-5 w-5 text-red-400" />} deals={feed.expiring} onSave={handleSave} onRedeem={handleRedeem} />
              <DealSection title="New Deals" icon={<TrendingUp className="h-5 w-5 text-emerald-400" />} deals={feed.newest} onSave={handleSave} onRedeem={handleRedeem} />
              <DealSection title="Most Saved" icon={<Bookmark className="h-5 w-5 text-indigo-400" />} deals={feed.mostSaved} onSave={handleSave} onRedeem={handleRedeem} />
              {feed.forYou.length > 0 && (
                <DealSection title="For You" icon={<Star className="h-5 w-5 text-purple-400" />} deals={feed.forYou} onSave={handleSave} onRedeem={handleRedeem} />
              )}
              {!feed.featured.length && !feed.trending.length && !feed.newest.length && (
                <div className="text-center py-12 text-muted-foreground">
                  <Tag className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No deals available right now. Check back soon!</p>
                </div>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* ── Search Tab ──────────────────────────────────────── */}
        <TabsContent value="search" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deals..."
                className="pl-9"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-background text-foreground">
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background text-foreground">
                {SORT_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => doSearch()} disabled={searchLoading}>
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {searchResults.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResults.map(d => (
                  <DealCard key={d.id} deal={d} onSave={handleSave} onRedeem={handleRedeem} />
                ))}
              </div>
              {hasMore && (
                <div className="text-center">
                  <Button variant="outline" onClick={() => doSearch(searchCursor!)} disabled={searchLoading}>
                    {searchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Load More
                  </Button>
                </div>
              )}
            </>
          ) : !searchLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Search for deals by keyword, category, or brand</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <DealCardSkeleton key={i} />)}
            </div>
          )}
        </TabsContent>

        {/* ── Saved Tab ───────────────────────────────────────── */}
        <TabsContent value="saved" className="mt-4">
          {savedDeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedDeals.map(d => (
                <DealCard key={d.id} deal={{ ...d, isSaved: true }} onSave={handleSave} onRedeem={handleRedeem} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No saved deals yet. Browse and save deals you like!</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

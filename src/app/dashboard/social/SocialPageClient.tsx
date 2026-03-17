'use client'

import { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  RefreshCw,
  Link2,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  Heart,
  Repeat2,
  Eye,
  Users,
  Star,
  BarChart3,
  Search,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { SocialPostCard, type SocialPostCardData } from '@/components/social-post-card'
import type { SocialAggregateMetrics, SocialTrendPoint } from '@/db/repositories/socialRepository'

// ============================================================================
// TYPES
// ============================================================================

type PlatformFilter = 'all' | string
type SentimentFilter = 'all' | 'positive' | 'neutral' | 'negative'

export type SocialPageData = {
  posts: SocialPostCardData[]
  total: number
  overview: {
    metrics: SocialAggregateMetrics
    trends: SocialTrendPoint[]
    topKeywords: Array<{ keyword: string; count: number }>
    recentHighlights: Array<{
      id: string
      platform: string
      author: string | null
      content: string
      sentiment: string | null
      likes: number
      postedAt: Date | null
    }>
  } | null
  productNames: Record<string, string>
  hasProducts: boolean
  isBrand: boolean
}

const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All platforms' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'meta', label: 'Meta / Facebook' },
  { value: 'google', label: 'Google Reviews' },
  { value: 'amazon', label: 'Amazon Reviews' },
  { value: 'flipkart', label: 'Flipkart Reviews' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
]

// ============================================================================
// OVERVIEW CARDS
// ============================================================================

function OverviewCards({ metrics }: { metrics: SocialAggregateMetrics }) {
  const sentimentPct = metrics.totalPosts > 0
    ? Math.round((metrics.bySentiment.positive / metrics.totalPosts) * 100)
    : 0

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total mentions</p>
          </div>
          <p className="text-2xl font-bold mt-1">{metrics.totalPosts.toLocaleString()}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(metrics.byPlatform).slice(0, 3).map(([p, c]) => (
              <Badge key={p} variant="secondary" className="text-[10px]">
                {p} {c}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <p className="text-xs text-muted-foreground">Positive sentiment</p>
          </div>
          <p className="text-2xl font-bold mt-1">{sentimentPct}%</p>
          <div className="flex gap-2 mt-2 text-[11px] text-muted-foreground">
            <span className="text-emerald-600">{metrics.bySentiment.positive} pos</span>
            <span>{metrics.bySentiment.neutral} neu</span>
            <span className="text-red-500">{metrics.bySentiment.negative} neg</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            <p className="text-xs text-muted-foreground">Total engagement</p>
          </div>
          <p className="text-2xl font-bold mt-1">
            {(metrics.totalLikes + metrics.totalShares + metrics.totalComments).toLocaleString()}
          </p>
          <div className="flex gap-2 mt-2 text-[11px] text-muted-foreground">
            <span>{metrics.totalLikes.toLocaleString()} likes</span>
            <span>{metrics.totalShares.toLocaleString()} shares</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-muted-foreground">Avg review rating</p>
          </div>
          <p className="text-2xl font-bold mt-1">
            {metrics.avgRating != null ? metrics.avgRating.toFixed(1) : '—'}
          </p>
          <div className="flex gap-2 mt-2 text-[11px] text-muted-foreground">
            <span>{metrics.kolCount} KOL mentions</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// KEYWORD CLOUD
// ============================================================================

function KeywordCloud({ keywords }: { keywords: Array<{ keyword: string; count: number }> }) {
  if (keywords.length === 0) return null
  const maxCount = Math.max(...keywords.map((k) => k.count), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Trending keywords</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {keywords.map((kw) => {
            const size = 0.7 + (kw.count / maxCount) * 0.5
            return (
              <Badge
                key={kw.keyword}
                variant="secondary"
                className="cursor-default"
                style={{ fontSize: `${size}rem` }}
              >
                {kw.keyword}
                <span className="ml-1 opacity-60">{kw.count}</span>
              </Badge>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// SUBMIT LINK FORM (brand only)
// ============================================================================

function SubmitLinkForm({ productNames }: { productNames: Record<string, string> }) {
  const [url, setUrl] = useState('')
  const [productId, setProductId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const products = Object.entries(productNames)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url || !productId) return

    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/social/submit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, productId, notes: notes || undefined }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setResult({ success: true, message: 'Link submitted and analyzed successfully!' })
        setUrl('')
        setNotes('')
      } else {
        setResult({ success: false, message: data.error || 'Failed to process link' })
      }
    } catch {
      setResult({ success: false, message: 'Network error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (products.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Submit a link for analysis
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Paste any social post, review, or article URL — we&apos;ll extract and analyze it.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="https://twitter.com/... or any review URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              type="url"
              required
            />
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Optional notes (e.g. context about this mention)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="resize-none"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={submitting || !url || !productId}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
              Analyze link
            </Button>
            {result && (
              <p className={`text-xs ${result.success ? 'text-emerald-600' : 'text-red-500'}`}>
                {result.message}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// MAIN CLIENT COMPONENT
// ============================================================================

export default function SocialPageClient({ data }: { data: SocialPageData }) {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [posts, setPosts] = useState(data.posts)
  const [total, setTotal] = useState(data.total)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(0)

  const fetchPosts = useCallback(async (
    platform: string,
    sentiment: string,
    search: string,
    offset = 0,
    append = false
  ) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (platform !== 'all') params.set('platform', platform)
      if (sentiment !== 'all') params.set('sentiment', sentiment)
      if (search) params.set('search', search)
      params.set('offset', String(offset))
      params.set('limit', '50')

      const res = await fetch(`/api/social?${params}`)
      const result = await res.json()
      if (append) {
        setPosts((prev) => [...prev, ...result.posts])
      } else {
        setPosts(result.posts)
      }
      setTotal(result.total)
    } catch (err) {
      console.error('Failed to fetch social posts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFilterChange = (platform: string, sentiment: string, search: string) => {
    setPage(0)
    fetchPosts(platform, sentiment, search)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/social/ingest', { method: 'POST' })
      await fetchPosts(platformFilter, sentimentFilter, searchQuery)
    } catch (err) {
      console.error('Failed to refresh:', err)
    } finally {
      setRefreshing(false)
    }
  }

  const loadMore = () => {
    const nextOffset = (page + 1) * 50
    setPage((p) => p + 1)
    fetchPosts(platformFilter, sentimentFilter, searchQuery, nextOffset, true)
  }

  const hasMore = posts.length < total

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-col gap-4 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl font-headline">Social Listening</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time monitoring of mentions, reviews, and discussions across all platforms.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.isBrand && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Refresh data
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Overview metrics */}
      {data.overview && data.overview.metrics.totalPosts > 0 && (
        <OverviewCards metrics={data.overview.metrics} />
      )}

      {/* Submit link + Keywords row */}
      {data.isBrand && (
        <div className="grid gap-4 md:grid-cols-2">
          <SubmitLinkForm productNames={data.productNames} />
          {data.overview && <KeywordCloud keywords={data.overview.topKeywords} />}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={platformFilter}
          onValueChange={(v) => {
            setPlatformFilter(v)
            handleFilterChange(v, sentimentFilter, searchQuery)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sentimentFilter}
          onValueChange={(v) => {
            setSentimentFilter(v as SentimentFilter)
            handleFilterChange(platformFilter, v, searchQuery)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Sentiment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sentiments</SelectItem>
            <SelectItem value="positive">Positive</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search mentions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFilterChange(platformFilter, sentimentFilter, searchQuery)
              }
            }}
            className="pl-9"
          />
        </div>

        <span className="text-sm text-muted-foreground self-center">
          {total.toLocaleString()} mention{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* No data state */}
      {!data.hasProducts && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No products found. Add a product first to start monitoring social mentions.
            </p>
          </CardContent>
        </Card>
      )}

      {data.hasProducts && posts.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No social mentions yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              {data.isBrand
                ? 'Click "Refresh data" to scan platforms, or submit a link manually.'
                : 'Social listening data will appear here once brands enable it.'}
            </p>
            {data.isBrand && (
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Scan platforms now
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Posts grid */}
      {posts.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <SocialPostCard
                key={post.id}
                post={post}
                productName={data.productNames[(post as any).productId] || undefined}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-1" />
                )}
                Load more ({total - posts.length} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {loading && posts.length === 0 && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

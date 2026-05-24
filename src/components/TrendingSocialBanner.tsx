'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Flame } from 'lucide-react'

type TrendingKeyword = {
  keyword: string
  count: number
  platforms: string[]
}

type Props = {
  /**
   * Optional category to restrict the trending aggregate to.
   * Maps to `?category=...` on the API.
   */
  category?: string
  /**
   * Time window in days (1–90). Default 7.
   */
  days?: number
  /**
   * Max keywords to render. Default 10.
   */
  limit?: number
  /**
   * Called when a keyword chip is clicked. If omitted, chips are
   * non-interactive (just display). The community page passes a
   * setter so clicking flows the keyword into the search input.
   */
  onKeywordClick?: (keyword: string) => void
}

/**
 * "Trending now" banner — fetches the top keywords from social_posts
 * and renders them as clickable chips above the community feed.
 *
 * Renders nothing while loading, nothing on error, and nothing when
 * the aggregate returns an empty set. Goal: never visually noisy,
 * never blocks the feed below.
 */
export function TrendingSocialBanner({
  category,
  days = 7,
  limit = 10,
  onKeywordClick,
}: Props) {
  const [keywords, setKeywords] = useState<TrendingKeyword[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    params.set('days', String(days))
    params.set('limit', String(limit))
    if (category) params.set('category', category)

    fetch(`/api/community/trending?${params}`)
      .then((r) => (r.ok ? r.json() : { keywords: [] }))
      .then((data) => {
        if (cancelled) return
        setKeywords(Array.isArray(data?.keywords) ? data.keywords : [])
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setLoaded(true) // hide silently on any failure
      })
    return () => {
      cancelled = true
    }
  }, [category, days, limit])

  if (!loaded || keywords.length === 0) return null

  return (
    <Card className="border-orange-200/50 bg-orange-50/40 dark:bg-orange-950/10 dark:border-orange-900/40">
      <CardContent className="p-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 dark:text-orange-300">
          <Flame className="h-4 w-4" />
          Trending now
        </span>
        {keywords.map((k) => (
          <button
            key={k.keyword}
            type="button"
            onClick={() => onKeywordClick?.(k.keyword)}
            disabled={!onKeywordClick}
            className={[
              'text-xs rounded-full border bg-background px-2.5 py-1',
              'transition-colors',
              onKeywordClick
                ? 'hover:border-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/30 cursor-pointer'
                : 'cursor-default',
            ].join(' ')}
            aria-label={`Search community for ${k.keyword}`}
          >
            <span className="font-medium">{k.keyword}</span>
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0 font-normal">
              {k.count}
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}

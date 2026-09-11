'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, TrendingUp, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WatchButton } from '@/components/WatchButton'
import { useEffect } from 'react'

interface RecommendationCardProps {
  product: {
    id: string
    name: string
    description?: string | null
    profile?: {
      category?: string
      categoryName?: string
      website?: string
      [key: string]: any
    } | null
  }
  /**
   * ⚠️ OPTIONAL ON PURPOSE. These were required, which meant a caller with no
   * real score had to invent one to render a card at all — and that is exactly
   * how `score: 50` with "Popular with other users" ended up on screen. Absent
   * means "personalization did not run", and the card shows no badge and no
   * reasons rather than a zero or a placeholder.
   */
  score?: number
  reasons?: string[]
  compact?: boolean
}

export function RecommendationCard({
  product,
  score,
  reasons,
  compact = false
}: RecommendationCardProps) {
  // Scored ONLY when a real score was supplied. `score === 0` is a legitimate
  // computed score, so test for undefined rather than falsiness.
  const isScored = typeof score === 'number'
  const matchPercentage = isScored ? Math.min(Math.round(score!), 100) : null
  const reasonList = reasons ?? []

  // Determine badge color based on score
  const getBadgeVariant = (score: number) => {
    if (score >= 70) return 'default' // Purple
    if (score >= 50) return 'secondary'
    return 'outline'
  }

  // Track when user views a recommendation.
  // ⚠️ Omits score/matchPercentage entirely when unscored — reporting a score
  // of 0 or null into analytics would put the same fiction in the data that
  // was just removed from the UI.
  useEffect(() => {
    fetch('/api/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'product_view',
        productId: product.id,
        metadata: isScored
          ? { source: 'recommendation', score, matchPercentage }
          : { source: 'catalogue' },
      })
    }).catch(err => console.error('Failed to track recommendation view:', err))
  }, [product.id, score, matchPercentage, isScored])

  const handleWebsiteClick = () => {
    // Track recommendation click (external link)
    fetch('/api/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'recommendation_click',
        productId: product.id,
        metadata: {
          source: 'recommendation',
          destination: 'external_website',
          url: product.profile?.website
        }
      })
    }).catch(err => console.error('Failed to track recommendation click:', err))
  }

  return (
    <Card 
      className="border-slate-700 hover:border-purple-500/50 transition-colors min-w-0 overflow-hidden"
      style={{ backgroundColor: '#0f172a', color: 'white' }}
    >
      <CardHeader className={compact ? 'pb-3' : 'pb-4'}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-purple-400 flex-shrink-0" />
              <h3 className="font-semibold text-lg truncate text-white">{product.name}</h3>
            </div>
            {product.profile?.categoryName && (
              <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                {product.profile.categoryName}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <WatchButton productId={product.id} size="sm" />
            {/* No score → no match badge and no "why recommended" tooltip.
                The whole block is omitted rather than rendered empty: a "0%
                match" or a blank reason list would be a claim about a
                computation that never ran. */}
            {isScored && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {matchPercentage}%
                      </div>
                      <div className="text-xs text-slate-400">match</div>
                    </div>
                  </TooltipTrigger>
                  {reasonList.length > 0 && (
                    <TooltipContent>
                      <p className="font-semibold mb-1">Why recommended:</p>
                      <ul className="text-xs space-y-1">
                        {reasonList.map((reason, idx) => (
                          <li key={idx}>• {reason}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardHeader>

      {!compact && (
        <CardContent className="pt-0">
          {product.description && (
            <p className="text-sm text-slate-300 mb-3 line-clamp-2">
              {product.description}
            </p>
          )}
          
          {/* "Why you're seeing this" — was ALWAYS visible, which is why a
              caller with nothing to say had to supply a reason. It now renders
              only when there is a real reason to give. */}
          {reasonList.length > 0 && (
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 mb-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-white mb-1">
                  Why you&apos;re seeing this
                </p>
                <p className="text-xs text-slate-200 font-medium">
                  {reasonList.slice(0, 2).join(' · ')}
                  {reasonList.length > 2 && ` · +${reasonList.length - 2} more reasons`}
                </p>
              </div>
            </div>
          </div>
          )}

          <div className="flex flex-wrap gap-2">
            {reasonList.slice(0, 2).map((reason, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-1.5 text-xs bg-purple-900/70 text-white font-medium px-2 py-1 rounded-full"
              >
                <TrendingUp className="h-3 w-3" />
                <span>{reason}</span>
              </div>
            ))}
            {reasonList.length > 2 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-slate-400 px-2 py-1 rounded-full border border-slate-600 border-dashed cursor-help">
                      <Info className="h-3 w-3" />
                      <span>+{reasonList.length - 2} more</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <ul className="text-xs space-y-1">
                      {reasonList.slice(2).map((reason, idx) => (
                        <li key={idx}>ΓÇó {reason}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {product.profile?.website && (
            <a
              href={product.profile.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWebsiteClick}
              className="inline-block mt-3 text-sm text-purple-400 hover:text-purple-300 underline"
            >
              Learn more ΓåÆ
            </a>
          )}
        </CardContent>
      )}
    </Card>
  )
}

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
  score: number
  reasons: string[]
  compact?: boolean
}

export function RecommendationCard({ 
  product, 
  score, 
  reasons,
  compact = false 
}: RecommendationCardProps) {
  // Calculate match percentage (score out of 100)
  const matchPercentage = Math.min(Math.round(score), 100)
  
  // Determine badge color based on score
  const getBadgeVariant = (score: number) => {
    if (score >= 70) return 'default' // Purple
    if (score >= 50) return 'secondary'
    return 'outline'
  }

  // Track when user views a recommendation
  useEffect(() => {
    // Track recommendation view
    fetch('/api/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'product_view',
        productId: product.id,
        metadata: {
          source: 'recommendation',
          score: score,
          matchPercentage: matchPercentage
        }
      })
    }).catch(err => console.error('Failed to track recommendation view:', err))
  }, [product.id, score, matchPercentage])

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
      className="border-slate-700 hover:border-purple-500/50 transition-colors"
      style={{ backgroundColor: '#0f172a', color: 'white' }}
    >
      <CardHeader className={compact ? 'pb-3' : 'pb-4'}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
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
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="text-2xl font-bold text-purple-400">
                    {matchPercentage}%
                  </div>
                  <div className="text-xs text-slate-400">match</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold mb-1">Why recommended:</p>
                <ul className="text-xs space-y-1">
                  {reasons.map((reason, idx) => (
                    <li key={idx}>ΓÇó {reason}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {!compact && (
        <CardContent className="pt-0">
          {product.description && (
            <p className="text-sm text-slate-300 mb-3 line-clamp-2">
              {product.description}
            </p>
          )}
          
          {/* Always-visible "Why you're seeing this" section */}
          <div className="bg-blue-900/50 dark:bg-blue-950/50 border border-blue-700 dark:border-blue-800 rounded-lg p-3 mb-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-200 mb-1">
                  Why you're seeing this
                </p>
                <p className="text-xs text-blue-300">
                  {reasons.slice(0, 2).join(' ΓÇó ')}
                  {reasons.length > 2 && ` ΓÇó +${reasons.length - 2} more reasons`}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {reasons.slice(0, 2).map((reason, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-1.5 text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded-full"
              >
                <TrendingUp className="h-3 w-3" />
                <span>{reason}</span>
              </div>
            ))}
            {reasons.length > 2 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-slate-400 px-2 py-1 rounded-full border border-slate-600 border-dashed cursor-help">
                      <Info className="h-3 w-3" />
                      <span>+{reasons.length - 2} more</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <ul className="text-xs space-y-1">
                      {reasons.slice(2).map((reason, idx) => (
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

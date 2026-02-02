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

  return (
    <Card className="hover:border-purple-500/50 transition-colors">
      <CardHeader className={compact ? 'pb-3' : 'pb-4'}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
              <h3 className="font-semibold text-lg truncate">{product.name}</h3>
            </div>
            {product.profile?.categoryName && (
              <Badge variant="outline" className="text-xs">
                {product.profile.categoryName}
              </Badge>
            )}
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="text-2xl font-bold text-purple-600">
                    {matchPercentage}%
                  </div>
                  <div className="text-xs text-muted-foreground">match</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold mb-1">Why recommended:</p>
                <ul className="text-xs space-y-1">
                  {reasons.map((reason, idx) => (
                    <li key={idx}>• {reason}</li>
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
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {product.description}
            </p>
          )}
          
          <div className="flex flex-wrap gap-2">
            {reasons.slice(0, 2).map((reason, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-1.5 text-xs bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full"
              >
                <TrendingUp className="h-3 w-3" />
                <span>{reason}</span>
              </div>
            ))}
            {reasons.length > 2 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded-full border border-dashed cursor-help">
                      <Info className="h-3 w-3" />
                      <span>+{reasons.length - 2} more</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <ul className="text-xs space-y-1">
                      {reasons.slice(2).map((reason, idx) => (
                        <li key={idx}>• {reason}</li>
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
              className="inline-block mt-3 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 underline"
            >
              Learn more →
            </a>
          )}
        </CardContent>
      )}
    </Card>
  )
}

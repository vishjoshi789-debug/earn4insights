'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Users, Star, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface CampaignCardProps {
  campaign: {
    id: string
    brandName: string | null
    title: string
    brief: string | null
    deliverables: string[]
    targetPlatforms: string[]
    budgetTotal: number
    budgetCurrency: string
    applicationDeadline: string | null
    applicationCount: number
    avgBrandRating: number | null
    icpMatchScore?: number | null
    hasApplied?: boolean
  }
  isInvited?: boolean
  onViewDetails: (id: string) => void
  onApply?: (id: string) => void
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-800',
  youtube: 'bg-red-100 text-red-800',
  twitter: 'bg-sky-100 text-sky-800',
  linkedin: 'bg-blue-100 text-blue-800',
  tiktok: 'bg-purple-100 text-purple-800',
}

function MatchBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-green-100 text-green-800 text-[10px]">Great Match</Badge>
  if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Good Match</Badge>
  return <Badge className="bg-gray-100 text-gray-800 text-[10px]">Fair Match</Badge>
}

function deadlineCountdown(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days === 1) return '1 day left'
  if (days <= 7) return `${days} days left`
  return new Date(deadline).toLocaleDateString()
}

export default function CampaignCard({ campaign, isInvited, onViewDetails, onApply }: CampaignCardProps) {
  return (
    <Card className="hover:border-primary/30 transition-colors h-full flex flex-col">
      <CardContent className="pt-4 flex flex-col flex-1">
        {/* Brand + Match */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium truncate">{campaign.brandName ?? 'Brand'}</span>
          <div className="flex items-center gap-1">
            {campaign.icpMatchScore != null && <MatchBadge score={campaign.icpMatchScore} />}
            {isInvited && <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">Invited</Badge>}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold line-clamp-2 mb-1">{campaign.title}</h3>

        {/* Budget */}
        <p className="text-xs font-medium text-primary mb-2">
          {formatCurrency(campaign.budgetTotal, campaign.budgetCurrency)}
        </p>

        {/* Platforms */}
        {campaign.targetPlatforms.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {campaign.targetPlatforms.slice(0, 3).map(p => (
              <Badge key={p} variant="outline" className={`text-[10px] ${PLATFORM_COLORS[p.toLowerCase()] ?? ''}`}>
                {p}
              </Badge>
            ))}
            {campaign.targetPlatforms.length > 3 && (
              <Badge variant="outline" className="text-[10px]">+{campaign.targetPlatforms.length - 3}</Badge>
            )}
          </div>
        )}

        {/* Deliverables */}
        {campaign.deliverables.length > 0 && (
          <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2">
            {campaign.deliverables.join(', ')}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-2">
          {campaign.applicationDeadline && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {deadlineCountdown(campaign.applicationDeadline)}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Users className="h-3 w-3" />
            {campaign.applicationCount} applied
          </span>
          {campaign.avgBrandRating && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {campaign.avgBrandRating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3 pt-2 border-t">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onViewDetails(campaign.id)}>
            View Details
          </Button>
          {campaign.hasApplied ? (
            <Badge className="bg-green-100 text-green-800 flex items-center gap-1 px-3">
              <CheckCircle className="h-3 w-3" /> Applied
            </Badge>
          ) : !isInvited && onApply ? (
            <Button size="sm" className="flex-1 text-xs" onClick={() => onApply(campaign.id)}>
              Apply Now
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

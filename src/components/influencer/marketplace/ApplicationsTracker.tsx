'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface ApplicationsTrackerProps {
  onViewCampaign: (campaignId: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  reviewing: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-800',
}

export default function ApplicationsTracker({ onViewCampaign }: ApplicationsTrackerProps) {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  useEffect(() => {
    const url = filter ? `/api/influencer/applications?status=${filter}` : '/api/influencer/applications'
    setLoading(true)
    fetch(url)
      .then(r => r.json())
      .then(d => setApplications(d.applications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {['', 'pending', 'reviewing', 'accepted', 'rejected', 'withdrawn'].map(s => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? 'default' : 'outline'}
            className="text-xs h-7"
            onClick={() => setFilter(s)}
          >
            {s || 'All'}
          </Button>
        ))}
      </div>

      {applications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <FileText className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">No applications{filter ? ` with status "${filter}"` : ''}</p>
            <p className="text-xs text-muted-foreground">Browse campaigns to find opportunities and apply.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app: any) => (
            <Card key={app.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{app.campaignTitle}</p>
                      <Badge className={STATUS_COLORS[app.status] ?? ''}>{app.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {app.brandName ?? 'Brand'} | Rate: {formatCurrency(app.proposedRate, app.proposedCurrency)} | Applied: {new Date(app.appliedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{app.proposalText}</p>
                    {app.brandResponse && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <span className="font-medium">Brand response:</span> {app.brandResponse}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2 shrink-0"
                    onClick={() => onViewCampaign(app.campaignId)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

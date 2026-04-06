'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, Megaphone, CheckCircle, XCircle, Upload, IndianRupee, Calendar, Target } from 'lucide-react'
import { toast } from 'sonner'

export default function InfluencerCampaignDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const campaignId = params.campaignId as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated' || !campaignId) return
    fetch(`/api/influencer/campaigns/${campaignId}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => toast.error('Failed to load campaign'))
      .finally(() => setLoading(false))
  }, [status, campaignId])

  const handleAction = async (action: string, extra?: Record<string, any>) => {
    setActing(true)
    try {
      const res = await fetch(`/api/influencer/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Action failed')
      }
      toast.success(action === 'accept' ? 'Invitation accepted!' : action === 'reject' ? 'Invitation declined' : 'Milestone submitted')
      // Reload data
      const refreshed = await fetch(`/api/influencer/campaigns/${campaignId}`).then(r => r.json())
      setData(refreshed)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data?.campaign) {
    return <p className="text-muted-foreground text-sm">Campaign not found.</p>
  }

  const { campaign, invitation, milestones, payments } = data

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <Megaphone className="h-6 w-6" />
          {campaign.title}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge>{campaign.status}</Badge>
          <Badge variant="outline">{invitation?.status}</Badge>
        </div>
      </div>

      {/* Accept/Reject for pending invitations */}
      {invitation?.status === 'invited' && (
        <Card className="border-primary/30">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm font-medium">You've been invited to this campaign</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={acting} onClick={() => handleAction('reject')}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Decline
              </Button>
              <Button size="sm" disabled={acting} onClick={() => handleAction('accept')}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Accept
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {campaign.brief && <p>{campaign.brief}</p>}
          {campaign.requirements && (
            <div>
              <span className="font-medium">Requirements:</span>
              <p className="text-muted-foreground">{campaign.requirements}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <IndianRupee className="h-3 w-3" />
              Budget: {(campaign.budgetTotal / 100).toLocaleString()} {campaign.budgetCurrency}
            </span>
            {campaign.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {campaign.startDate} — {campaign.endDate ?? '...'}
              </span>
            )}
            <span>Payment: {campaign.paymentType}</span>
          </div>
          {campaign.deliverables?.length > 0 && (
            <div>
              <span className="font-medium text-xs">Deliverables:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {campaign.deliverables.map((d: string) => (
                  <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      {milestones && milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Milestones</CardTitle>
            <CardDescription className="text-xs">Submit deliverables when each milestone is ready.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {milestones.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">{m.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                    <span>{(m.paymentAmount / 100).toLocaleString()} {campaign.budgetCurrency}</span>
                    {m.dueDate && <span>Due: {m.dueDate}</span>}
                  </div>
                </div>
                {(m.status === 'pending' || m.status === 'in_progress' || m.status === 'rejected') && invitation?.status !== 'invited' && (
                  <Button size="sm" variant="outline" disabled={acting} onClick={() => handleAction('submit_milestone', { milestoneId: m.id })}>
                    <Upload className="h-3 w-3 mr-1" /> Submit
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

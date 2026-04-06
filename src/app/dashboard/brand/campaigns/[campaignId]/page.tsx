'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Loader2, Megaphone, Users, Target, IndianRupee, CheckCircle, XCircle,
  Plus, Play, Ban, Trophy, AlertTriangle, BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'

export default function BrandCampaignDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const campaignId = params.campaignId as string

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteId, setInviteId] = useState('')

  // Milestone dialog
  const [msOpen, setMsOpen] = useState(false)
  const [msForm, setMsForm] = useState({ title: '', paymentAmount: '', dueDate: '' })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  const loadData = () => {
    fetch(`/api/brand/campaigns/${campaignId}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && campaignId) loadData()
  }, [status, campaignId])

  const changeStatus = async (newStatus: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/brand/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(`Campaign ${newStatus}`)
      loadData()
    } catch (err: any) { toast.error(err.message) }
    finally { setActing(false) }
  }

  const inviteInfluencer = async () => {
    if (!inviteId) return
    setActing(true)
    try {
      const res = await fetch(`/api/brand/campaigns/${campaignId}/influencers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerId: inviteId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Influencer invited')
      setInviteOpen(false)
      setInviteId('')
      loadData()
    } catch (err: any) { toast.error(err.message) }
    finally { setActing(false) }
  }

  const addMilestone = async () => {
    if (!msForm.title || !msForm.paymentAmount) return
    setActing(true)
    try {
      const res = await fetch(`/api/brand/campaigns/${campaignId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: msForm.title,
          paymentAmount: Math.round(parseFloat(msForm.paymentAmount) * 100),
          dueDate: msForm.dueDate || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Milestone added')
      setMsOpen(false)
      setMsForm({ title: '', paymentAmount: '', dueDate: '' })
      loadData()
    } catch (err: any) { toast.error(err.message) }
    finally { setActing(false) }
  }

  const milestoneAction = async (milestoneId: string, action: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/brand/campaigns/${campaignId}/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(`Milestone ${action}d`)
      loadData()
    } catch (err: any) { toast.error(err.message) }
    finally { setActing(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }
  if (!data?.campaign) {
    return <p className="text-muted-foreground text-sm">Campaign not found.</p>
  }

  const { campaign, influencers, milestones, payments } = data

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline">{campaign.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{campaign.status}</Badge>
            <span className="text-xs text-muted-foreground">
              <IndianRupee className="h-3 w-3 inline" /> {(campaign.budgetTotal / 100).toLocaleString()} {campaign.budgetCurrency}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <Button size="sm" onClick={() => changeStatus('proposed')} disabled={acting}>
              <Play className="h-3.5 w-3.5 mr-1" /> Publish
            </Button>
          )}
          {['proposed', 'negotiating'].includes(campaign.status) && (
            <Button size="sm" onClick={() => changeStatus('active')} disabled={acting}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Activate
            </Button>
          )}
          {campaign.status === 'active' && (
            <Button size="sm" variant="outline" onClick={() => changeStatus('completed')} disabled={acting}>
              <Trophy className="h-3.5 w-3.5 mr-1" /> Complete
            </Button>
          )}
          {!['completed', 'cancelled'].includes(campaign.status) && (
            <Button size="sm" variant="destructive" onClick={() => changeStatus('cancelled')} disabled={acting}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Brief */}
      {campaign.brief && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Brief</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{campaign.brief}</p></CardContent>
        </Card>
      )}

      {/* Influencers */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><Users className="h-4 w-4" /> Influencers ({influencers?.length ?? 0})</CardTitle>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Invite</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite Influencer</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label>Influencer User ID</Label>
                    <Input value={inviteId} onChange={e => setInviteId(e.target.value)} placeholder="Enter user ID" />
                  </div>
                  <Button onClick={inviteInfluencer} disabled={acting} className="w-full">Send Invitation</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {(!influencers || influencers.length === 0) ? (
            <p className="text-xs text-muted-foreground italic">No influencers invited yet.</p>
          ) : (
            <div className="space-y-2">
              {influencers.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between border rounded-lg p-2.5 text-sm">
                  <div>
                    <span className="font-medium text-xs">{inv.influencerId}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{inv.status}</Badge>
                      {inv.agreedRate && <span className="text-[10px] text-muted-foreground">{(inv.agreedRate / 100).toLocaleString()} INR</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><Target className="h-4 w-4" /> Milestones ({milestones?.length ?? 0})</CardTitle>
            <Dialog open={msOpen} onOpenChange={setMsOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label>Title *</Label>
                    <Input value={msForm.title} onChange={e => setMsForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment Amount (INR) *</Label>
                    <Input type="number" value={msForm.paymentAmount} onChange={e => setMsForm(f => ({ ...f, paymentAmount: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due Date</Label>
                    <Input type="date" value={msForm.dueDate} onChange={e => setMsForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                  <Button onClick={addMilestone} disabled={acting} className="w-full">Add Milestone</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {(!milestones || milestones.length === 0) ? (
            <p className="text-xs text-muted-foreground italic">No milestones defined.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((ms: any) => (
                <div key={ms.id} className="flex items-center justify-between border rounded-lg p-2.5">
                  <div>
                    <p className="text-sm font-medium">{ms.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{ms.status}</Badge>
                      <span>{(ms.paymentAmount / 100).toLocaleString()} INR</span>
                      {ms.dueDate && <span>Due: {ms.dueDate}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {ms.status === 'submitted' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => milestoneAction(ms.id, 'approve')} disabled={acting}>
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => milestoneAction(ms.id, 'reject')} disabled={acting}>
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {ms.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => milestoneAction(ms.id, 'escrow')} disabled={acting}>
                        Escrow
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><IndianRupee className="h-4 w-4" /> Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold">{((payments?.totalEscrowed ?? 0) / 100).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Escrowed</p>
            </div>
            <div>
              <p className="text-lg font-bold">{((payments?.totalPaid ?? 0) / 100).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Released</p>
            </div>
            <div>
              <p className="text-lg font-bold">{((campaign.budgetTotal - (payments?.totalPaid ?? 0) - (payments?.totalEscrowed ?? 0)) / 100).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

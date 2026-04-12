'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Loader2, X, Star, Calendar, Users, CheckCircle, ArrowLeft } from 'lucide-react'
import { formatCurrency, getSupportedCurrencies } from '@/lib/currency'
import { toast } from 'sonner'

interface CampaignDetailPanelProps {
  campaignId: string
  onClose: () => void
  onApplicationChange: () => void
}

export default function CampaignDetailPanel({ campaignId, onClose, onApplicationChange }: CampaignDetailPanelProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  const [proposal, setProposal] = useState('')
  const [rate, setRate] = useState('')
  const [currency, setCurrency] = useState('INR')

  useEffect(() => {
    fetch(`/api/marketplace/campaigns/${campaignId}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => toast.error('Failed to load campaign'))
      .finally(() => setLoading(false))
  }, [campaignId])

  const handleApply = async () => {
    if (proposal.length < 50) { toast.error('Proposal must be at least 50 characters'); return }
    if (!rate || parseFloat(rate) <= 0) { toast.error('Enter a valid rate'); return }

    setApplying(true)
    try {
      const res = await fetch(`/api/marketplace/campaigns/${campaignId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalText: proposal,
          proposedRate: Math.round(parseFloat(rate) * 100),
          proposedCurrency: currency,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Application submitted!')
      onApplicationChange()
      // Reload detail
      const updated = await fetch(`/api/marketplace/campaigns/${campaignId}`).then(r => r.json())
      setData(updated)
    } catch (err: any) { toast.error(err.message) }
    finally { setApplying(false) }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    try {
      const res = await fetch(`/api/marketplace/campaigns/${campaignId}/apply`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Application withdrawn')
      onApplicationChange()
      const updated = await fetch(`/api/marketplace/campaigns/${campaignId}`).then(r => r.json())
      setData(updated)
    } catch (err: any) { toast.error(err.message) }
    finally { setWithdrawing(false) }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-lg bg-background border-l shadow-xl p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    )
  }

  if (!data?.campaign) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-lg bg-background border-l shadow-xl p-6">
          <p className="text-sm text-muted-foreground">Campaign not found.</p>
          <Button variant="outline" size="sm" onClick={onClose} className="mt-4">Close</Button>
        </div>
      </div>
    )
  }

  const { campaign, application, isInvited } = data
  const currencies = getSupportedCurrencies()

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background border-l shadow-xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center gap-3 z-10">
          <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-semibold truncate flex-1">{campaign.title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Brand info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{campaign.brandName ?? 'Brand'}</p>
              {campaign.avgBrandRating && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {Number(campaign.avgBrandRating).toFixed(1)} avg rating
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-primary">{formatCurrency(campaign.budgetTotal, campaign.budgetCurrency)}</p>
              <p className="text-[11px] text-muted-foreground">{campaign.paymentType} payment</p>
            </div>
          </div>

          {/* ICP Match */}
          {campaign.icpMatchScore != null && (
            <Badge className={
              campaign.icpMatchScore >= 80 ? 'bg-green-100 text-green-800' :
              campaign.icpMatchScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }>
              {campaign.icpMatchScore >= 80 ? 'Great Match' : campaign.icpMatchScore >= 60 ? 'Good Match' : 'Fair Match'}
              {' '}{campaign.icpMatchScore}%
            </Badge>
          )}

          <Separator />

          {/* Brief */}
          {campaign.brief && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Brief</p>
              <p className="text-sm">{campaign.brief}</p>
            </div>
          )}

          {/* Requirements */}
          {campaign.requirements && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Requirements</p>
              <p className="text-sm">{campaign.requirements}</p>
            </div>
          )}

          {/* Deliverables */}
          {campaign.deliverables?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Deliverables</p>
              <ul className="list-disc list-inside text-sm space-y-0.5">
                {campaign.deliverables.map((d: string, i: number) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}

          {/* Platforms + Geography */}
          <div className="grid grid-cols-2 gap-4">
            {campaign.targetPlatforms?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Platforms</p>
                <div className="flex flex-wrap gap-1">
                  {campaign.targetPlatforms.map((p: string) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                </div>
              </div>
            )}
            {campaign.targetGeography?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Geography</p>
                <div className="flex flex-wrap gap-1">
                  {campaign.targetGeography.map((g: string) => <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>)}
                </div>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {campaign.applicationDeadline && (
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Deadline: {new Date(campaign.applicationDeadline).toLocaleDateString()}</span>
            )}
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {campaign.applicationCount} applicants</span>
          </div>

          <Separator />

          {/* Application section */}
          {isInvited ? (
            <Card className="bg-indigo-50 border-indigo-200">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-indigo-800">You&apos;ve been directly invited to this campaign.</p>
                <p className="text-xs text-indigo-600 mt-1">Check your campaigns page to respond to the invitation.</p>
              </CardContent>
            </Card>
          ) : application ? (
            <Card className="bg-muted">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Your Application
                  <Badge className={
                    application.status === 'accepted' ? 'bg-green-100 text-green-800' :
                    application.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }>{application.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{application.proposalText}</p>
                <p className="text-xs text-muted-foreground">
                  Rate: {formatCurrency(application.proposedRate, application.proposedCurrency)}
                </p>
                {application.brandResponse && (
                  <div className="p-2 bg-background rounded border text-xs">
                    <span className="font-medium">Brand response:</span> {application.brandResponse}
                  </div>
                )}
                {application.status === 'pending' && (
                  <Button size="sm" variant="outline" onClick={handleWithdraw} disabled={withdrawing} className="mt-2">
                    {withdrawing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Withdraw Application
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Apply to this Campaign</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Proposal <span className="text-muted-foreground text-[10px]">({proposal.length}/50 min)</span></Label>
                  <Textarea
                    value={proposal}
                    onChange={e => setProposal(e.target.value)}
                    rows={4}
                    placeholder="Describe why you're the right fit for this campaign..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Proposed Rate</Label>
                    <Input type="number" min="1" value={rate} onChange={e => setRate(e.target.value)} placeholder="5000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Currency</Label>
                    <select
                      className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                    >
                      {currencies.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                    </select>
                  </div>
                </div>
                <Button onClick={handleApply} disabled={applying} className="w-full">
                  {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Submit Application
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

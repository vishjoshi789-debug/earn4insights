'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Loader2, Megaphone, Plus, IndianRupee, Calendar, Users } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  proposed: 'bg-blue-100 text-blue-800',
  negotiating: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  disputed: 'bg-orange-100 text-orange-800',
}

export default function BrandCampaignsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [form, setForm] = useState({
    title: '', brief: '', budgetTotal: '', deliverables: '', targetPlatforms: '',
    startDate: '', endDate: '', paymentType: 'escrow',
    reviewSlaHours: '' as string, autoApproveEnabled: false,
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && (session?.user as any)?.role !== 'brand') router.push('/dashboard')
  }, [status, session, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/brand/campaigns')
      .then(r => r.json())
      .then(data => setCampaigns(data.campaigns ?? []))
      .finally(() => setLoading(false))
  }, [status])

  const handleCreate = async () => {
    if (!form.title || !form.budgetTotal) { toast.error('Title and budget required'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/brand/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          brief: form.brief || undefined,
          budgetTotal: Math.round(parseFloat(form.budgetTotal) * 100),
          deliverables: form.deliverables.split(',').map(s => s.trim()).filter(Boolean),
          targetPlatforms: form.targetPlatforms.split(',').map(s => s.trim()).filter(Boolean),
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          paymentType: form.paymentType,
          reviewSlaHours: form.reviewSlaHours ? parseInt(form.reviewSlaHours) : undefined,
          autoApproveEnabled: form.autoApproveEnabled,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      const data = await res.json()
      setCampaigns(prev => [data.campaign, ...prev])
      setDialogOpen(false)
      setForm({ title: '', brief: '', budgetTotal: '', deliverables: '', targetPlatforms: '', startDate: '', endDate: '', paymentType: 'escrow', reviewSlaHours: '', autoApproveEnabled: false })
      toast.success('Campaign created as draft')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const filtered = activeTab === 'all' ? campaigns : campaigns.filter(c => c.status === activeTab)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Influencer Campaigns
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage influencer marketing campaigns.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2 flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Summer Beauty Collab" />
              </div>
              <div className="space-y-1.5">
                <Label>Brief</Label>
                <Textarea value={form.brief} onChange={e => setForm(f => ({ ...f, brief: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Budget (INR) *</Label>
                  <Input type="number" value={form.budgetTotal} onChange={e => setForm(f => ({ ...f, budgetTotal: e.target.value }))} placeholder="50000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Type</Label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.paymentType} onChange={e => setForm(f => ({ ...f, paymentType: e.target.value }))}>
                    <option value="escrow">Escrow</option>
                    <option value="milestone">Milestone</option>
                    <option value="direct">Direct</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Deliverables (comma-separated)</Label>
                <Input value={form.deliverables} onChange={e => setForm(f => ({ ...f, deliverables: e.target.value }))} placeholder="1 reel, 2 stories, 1 blog post" />
              </div>
              <div className="space-y-1.5">
                <Label>Target Platforms (comma-separated)</Label>
                <Input value={form.targetPlatforms} onChange={e => setForm(f => ({ ...f, targetPlatforms: e.target.value }))} placeholder="instagram, youtube" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div className="border-t pt-3 space-y-3">
                <p className="text-sm font-medium">Content Review SLA</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Review SLA</Label>
                    <select
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={form.reviewSlaHours}
                      onChange={e => setForm(f => ({ ...f, reviewSlaHours: e.target.value }))}
                    >
                      <option value="">None</option>
                      <option value="24">24 hours</option>
                      <option value="48">48 hours</option>
                      <option value="72">72 hours</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  {form.reviewSlaHours === 'custom' && (
                    <div className="space-y-1.5">
                      <Label>Custom Hours</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 96"
                        value={form.reviewSlaHours === 'custom' ? '' : form.reviewSlaHours}
                        onChange={e => setForm(f => ({ ...f, reviewSlaHours: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Auto-approve on SLA expiry</p>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically approve content if you don&apos;t review before the SLA expires.
                    </p>
                  </div>
                  <Switch
                    checked={form.autoApproveEnabled}
                    onCheckedChange={checked => setForm(f => ({ ...f, autoApproveEnabled: checked }))}
                  />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Draft Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <Megaphone className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">No campaigns</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((c: any) => (
                <Link key={c.id} href={`/dashboard/brand/campaigns/${c.id}`}>
                  <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">{c.title}</CardTitle>
                        <Badge className={STATUS_COLORS[c.status] ?? ''}>{c.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <IndianRupee className="h-3 w-3" />
                          {(c.budgetTotal / 100).toLocaleString()} {c.budgetCurrency}
                        </span>
                        <span>{c.paymentType}</span>
                        {c.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {c.startDate}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Plus, Tag, Eye, Bookmark, Copy, TrendingUp, Pause, Play,
  Loader2, BarChart3, Clock,
} from 'lucide-react'
import { toast } from 'sonner'

type Deal = {
  id: string; title: string; description: string; dealType: string
  discountValue: string | null; promoCode: string | null
  redirectUrl: string | null; originalPrice: number | null
  discountedPrice: number | null; maxRedemptions: number | null
  redemptionCount: number; validUntil: string | null; category: string | null
  status: string; isFeatured: boolean; viewCount: number; saveCount: number
  createdAt: string
}

type Analytics = {
  viewCount: number; saveCount: number; redemptionCount: number
  status: string; createdAt: string; validUntil: string | null
}

const CATEGORIES = [
  'Electronics', 'Fashion', 'Food & Beverage', 'Health & Beauty',
  'Home & Living', 'Travel', 'Entertainment', 'Education',
  'Finance', 'Sports', 'Automotive', 'Other',
]

const DEAL_TYPES = [
  { value: 'percentage_off', label: 'Percentage Off' },
  { value: 'flat_off', label: 'Flat Discount' },
  { value: 'bogo', label: 'Buy One Get One' },
  { value: 'free_shipping', label: 'Free Shipping' },
  { value: 'bundle', label: 'Bundle Deal' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-800 text-gray-300',
  active: 'bg-emerald-900/50 text-emerald-300',
  paused: 'bg-amber-900/50 text-amber-300',
  expired: 'bg-red-900/50 text-red-300',
}

export default function BrandDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [analyticsId, setAnalyticsId] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)

  // Create form
  const [form, setForm] = useState({
    title: '', description: '', dealType: 'percentage_off', discountValue: '',
    promoCode: '', redirectUrl: '', originalPrice: '', discountedPrice: '',
    maxRedemptions: '', validUntil: '', category: '',
  })

  const loadDeals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/brand/deals?${params}`)
      const data = await res.json()
      setDeals(data.deals ?? [])
    } catch { toast.error('Failed to load deals') }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { loadDeals() }, [loadDeals])

  const handleCreate = async () => {
    if (!form.title || !form.description || !form.dealType) {
      toast.error('Title, description, and deal type are required')
      return
    }
    setCreating(true)
    try {
      const body: any = {
        title: form.title,
        description: form.description,
        dealType: form.dealType,
        category: form.category || null,
      }
      if (form.discountValue) body.discountValue = Number(form.discountValue)
      if (form.promoCode) body.promoCode = form.promoCode
      if (form.redirectUrl) body.redirectUrl = form.redirectUrl
      if (form.originalPrice) body.originalPrice = Number(form.originalPrice)
      if (form.discountedPrice) body.discountedPrice = Number(form.discountedPrice)
      if (form.maxRedemptions) body.maxRedemptions = Number(form.maxRedemptions)
      if (form.validUntil) body.validUntil = form.validUntil

      const res = await fetch('/api/brand/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Deal created as draft')
      setShowCreate(false)
      setForm({ title: '', description: '', dealType: 'percentage_off', discountValue: '', promoCode: '', redirectUrl: '', originalPrice: '', discountedPrice: '', maxRedemptions: '', validUntil: '', category: '' })
      loadDeals()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create deal')
    } finally { setCreating(false) }
  }

  const handlePublish = async (dealId: string) => {
    const res = await fetch(`/api/brand/deals/${dealId}/publish`, { method: 'POST' })
    if (res.ok) { toast.success('Deal published!'); loadDeals() }
    else toast.error('Publish failed')
  }

  const handlePause = async (dealId: string) => {
    const res = await fetch(`/api/brand/deals/${dealId}/pause`, { method: 'POST' })
    if (res.ok) { toast.success('Deal paused'); loadDeals() }
    else toast.error('Pause failed')
  }

  const showAnalytics = async (dealId: string) => {
    setAnalyticsId(dealId)
    const res = await fetch(`/api/brand/deals/${dealId}/analytics`)
    const data = await res.json()
    setAnalytics(data.analytics ?? null)
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Deals</h1>
          <p className="text-muted-foreground text-sm">Create and manage promotional deals for consumers</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Plus className="h-4 w-4 mr-1" />Create Deal
        </Button>
      </div>

      {/* Filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent className="bg-background text-foreground">
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="paused">Paused</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
        </SelectContent>
      </Select>

      {/* Deals List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/60"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : deals.length > 0 ? (
        <div className="space-y-3">
          {deals.map(deal => (
            <Card key={deal.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{deal.title}</h3>
                      <Badge className={`text-[10px] ${STATUS_COLORS[deal.status] ?? ''}`}>{deal.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{deal.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{deal.viewCount}</span>
                      <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" />{deal.saveCount}</span>
                      <span className="flex items-center gap-1"><Copy className="h-3 w-3" />{deal.redemptionCount} redeemed</span>
                      {deal.category && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{deal.category}</span>}
                      {deal.validUntil && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(deal.validUntil).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(deal.status === 'draft' || deal.status === 'paused') && (
                      <Button size="sm" variant="outline" onClick={() => handlePublish(deal.id)}>
                        <Play className="h-3 w-3 mr-1" />Publish
                      </Button>
                    )}
                    {deal.status === 'active' && (
                      <Button size="sm" variant="outline" onClick={() => handlePause(deal.id)}>
                        <Pause className="h-3 w-3 mr-1" />Pause
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => showAnalytics(deal.id)}>
                      <BarChart3 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Tag className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No deals yet. Create your first deal to start attracting consumers!</p>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Deal</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            <Input placeholder="Deal title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Textarea placeholder="Description" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.dealType} onValueChange={v => setForm(f => ({ ...f, dealType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background text-foreground">
                  {DEAL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent className="bg-background text-foreground">
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Discount value (e.g. 20 for 20%)" type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} />
            <Input placeholder="Promo code (optional)" value={form.promoCode} onChange={e => setForm(f => ({ ...f, promoCode: e.target.value }))} />
            <Input placeholder="Redirect URL (optional)" value={form.redirectUrl} onChange={e => setForm(f => ({ ...f, redirectUrl: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Original price" type="number" value={form.originalPrice} onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))} />
              <Input placeholder="Discounted price" type="number" value={form.discountedPrice} onChange={e => setForm(f => ({ ...f, discountedPrice: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Max redemptions" type="number" value={form.maxRedemptions} onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))} />
              <Input type="datetime-local" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={!!analyticsId} onOpenChange={() => { setAnalyticsId(null); setAnalytics(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deal Analytics</DialogTitle></DialogHeader>
          {analytics ? (
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{analytics.viewCount}</p>
                <p className="text-xs text-muted-foreground">Views</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{analytics.saveCount}</p>
                <p className="text-xs text-muted-foreground">Saves</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{analytics.redemptionCount}</p>
                <p className="text-xs text-muted-foreground">Redemptions</p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

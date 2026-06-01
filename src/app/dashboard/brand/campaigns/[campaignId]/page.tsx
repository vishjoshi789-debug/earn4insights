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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Loader2, Megaphone, Users, Target, IndianRupee, CheckCircle, XCircle,
  Plus, Play, Ban, Trophy, AlertTriangle, BarChart3, FileText,
  CreditCard, ShieldCheck, ArrowDownToLine, ChevronDown, Pencil, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RazorpayCheckout } from '@/components/payments/RazorpayCheckout'
import { formatCurrency } from '@/lib/currency'
import { apiPost, apiPatch } from '@/lib/api-client'

// Statuses where a brand may edit campaign details (3D, Q1).
// Mirrors EDITABLE_STATUSES in campaignManagementService so the UI
// hides Edit before the server has to refuse it.
const EDITABLE_STATUSES = new Set(['draft', 'proposed', 'negotiating'])
const DRAFT_STORAGE_PREFIX = 'e4i_campaign_edit_draft:'

// Q5 / smoke: the form shape — string-flavoured for <input> ergonomics.
// Numeric + array fields convert at submit time so the API receives
// the same shape as the create dialog.
type EditFormState = {
  title: string
  brief: string
  budgetTotal: string             // INR rupees as string (×100 on submit)
  deliverables: string            // comma-separated for ergonomics
  targetPlatforms: string         // comma-separated
  startDate: string               // YYYY-MM-DD
  endDate: string                 // YYYY-MM-DD
  paymentType: 'escrow' | 'milestone' | 'direct'
  reviewSlaHours: string          // '' | '24' | '48' | '72' | custom number
  autoApproveEnabled: boolean
  isPublic: boolean
  maxInfluencers: string
  applicationDeadline: string
}

function campaignToForm(c: any): EditFormState {
  return {
    title: c?.title ?? '',
    brief: c?.brief ?? '',
    budgetTotal: c?.budgetTotal ? String(c.budgetTotal / 100) : '',
    deliverables: Array.isArray(c?.deliverables) ? c.deliverables.join(', ') : '',
    targetPlatforms: Array.isArray(c?.targetPlatforms) ? c.targetPlatforms.join(', ') : '',
    startDate: c?.startDate ?? '',
    endDate: c?.endDate ?? '',
    paymentType: (c?.paymentType ?? 'escrow') as 'escrow' | 'milestone' | 'direct',
    reviewSlaHours: c?.reviewSlaHours != null ? String(c.reviewSlaHours) : '',
    autoApproveEnabled: !!c?.autoApproveEnabled,
    isPublic: !!c?.isPublic,
    maxInfluencers: c?.maxInfluencers != null ? String(c.maxInfluencers) : '',
    applicationDeadline: c?.applicationDeadline ?? '',
  }
}

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

  // Applications
  const [applications, setApplications] = useState<any[]>([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [activeSection, setActiveSection] = useState('overview')

  // Payment tab state
  const [paymentSummary, setPaymentSummary] = useState<any>(null)
  const [razorpayOrder, setRazorpayOrder] = useState<any>(null)
  const [paymentTabLoaded, setPaymentTabLoaded] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState(false)
  // Release payment state
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false)
  const [releaseMilestone, setReleaseMilestone] = useState<any>(null)
  const [releaseInfluencerId, setReleaseInfluencerId] = useState('')
  const [releasing, setReleasing] = useState(false)
  // Refund state
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refunding, setRefunding] = useState(false)

  // Status-transition confirm modal (3C). One modal serves all four
  // transitions (publish / activate / complete / cancel) — content is
  // keyed by `pendingStatus`. cancelReason is wired only for the
  // 'cancelled' path.
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Edit dialog (3D). Brand-edit lifecycle for draft / proposed /
  // negotiating campaigns. sessionStorage-keyed by campaignId so a
  // navigate-away-and-back doesn't lose typed changes.
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditFormState>(() => campaignToForm(null))
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [editSaving, setEditSaving] = useState(false)

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

  const loadApplications = () => {
    setAppsLoading(true)
    fetch(`/api/brand/campaigns/${campaignId}/applications`)
      .then(r => r.json())
      .then(d => setApplications(d.applications ?? []))
      .catch(() => {})
      .finally(() => setAppsLoading(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && campaignId) loadData()
  }, [status, campaignId])

  useEffect(() => {
    if (activeSection === 'applications' && campaignId && status === 'authenticated') loadApplications()
  }, [activeSection, campaignId, status])

  useEffect(() => {
    if (activeSection === 'payment' && campaignId && status === 'authenticated' && !paymentTabLoaded) {
      loadPaymentTab()
    }
  }, [activeSection, campaignId, status])

  const loadPaymentTab = async () => {
    setPaymentTabLoaded(true)
    try {
      const [summaryRes, orderRes] = await Promise.all([
        fetch(`/api/brand/campaigns/${campaignId}/payments`),
        fetch(`/api/brand/campaigns/${campaignId}/razorpay-order`),
      ])
      if (summaryRes.ok) setPaymentSummary(await summaryRes.json())
      if (orderRes.ok) {
        const { order } = await orderRes.json()
        setRazorpayOrder(order)
      }
    } catch {
      toast.error('Failed to load payment data')
    }
  }

  const createPaymentOrder = async () => {
    if (!data?.campaign) return
    setCreatingOrder(true)
    try {
      const res = await apiPost('/api/payments/create-order', {
        campaignId,
        currency: data.campaign.budgetCurrency ?? 'INR',
        paymentType: data.campaign.paymentType ?? 'escrow',
        amount: data.campaign.budgetTotal,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setRazorpayOrder(result)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create payment order')
    } finally {
      setCreatingOrder(false)
    }
  }

  const releasePayment = async () => {
    if (!releaseMilestone || !releaseInfluencerId) return
    setReleasing(true)
    try {
      const res = await apiPost(`/api/payments/release/${campaignId}`, { milestoneId: releaseMilestone.id, influencerId: releaseInfluencerId })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Payment released! Payout queued for admin processing.')
      setReleaseConfirmOpen(false)
      setReleaseMilestone(null)
      setReleaseInfluencerId('')
      loadPaymentTab()
      loadData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setReleasing(false)
    }
  }

  const requestRefund = async () => {
    if (!refundReason.trim()) { toast.error('Please provide a reason for the refund'); return }
    if (!razorpayOrder?.razorpayOrderId) return
    setRefunding(true)
    try {
      const res = await apiPost(`/api/payments/refund/${razorpayOrder.razorpayOrderId}`, { reason: refundReason })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Refund requested successfully')
      setRefundOpen(false)
      setRefundReason('')
      loadPaymentTab()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRefunding(false)
    }
  }

  // ── Status transitions (3C) ───────────────────────────────────
  //
  // Two-step: button opens the confirm modal, modal's primary action
  // calls executeStatusChange. apiPatch auto-attaches the CSRF token
  // from the e4i-csrf cookie — pre-3C this used raw fetch and the
  // PATCH route had no CSRF gate (now both fixed).

  const openStatusConfirm = (newStatus: string) => {
    setCancelReason('')
    setPendingStatus(newStatus)
  }

  const executeStatusChange = async () => {
    if (!pendingStatus) return
    const target = pendingStatus
    setActing(true)
    try {
      const res = await apiPatch(`/api/brand/campaigns/${campaignId}`, {
        status: target,
        cancelReason: target === 'cancelled' && cancelReason.trim()
          ? cancelReason.trim()
          : undefined,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed to ${target}`)
      }
      const verb =
        target === 'proposed' ? 'published'
        : target === 'active' ? 'activated'
        : target === 'completed' ? 'marked complete'
        : target === 'cancelled' ? 'cancelled'
        : target
      toast.success(`Campaign ${verb}`)
      setPendingStatus(null)
      setCancelReason('')
      loadData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActing(false)
    }
  }

  // ── Edit dialog (3D) ──────────────────────────────────────────
  //
  // Hydration order on open:
  //   1. sessionStorage draft for this campaignId (preserves typing
  //      across navigation/refresh)
  //   2. fall back to the loaded campaign row
  // Cleared on successful save or explicit Cancel.

  const openEditDialog = () => {
    if (!data?.campaign) return
    const draftKey = `${DRAFT_STORAGE_PREFIX}${campaignId}`
    let initial = campaignToForm(data.campaign)
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(draftKey)
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<EditFormState>
          initial = { ...initial, ...parsed }
        }
      } catch {
        // sessionStorage disabled / quota — fall through with DB values.
      }
    }
    setEditForm(initial)
    setEditErrors({})
    setEditOpen(true)
  }

  // Persist the in-progress edit on every change so navigating away
  // mid-edit doesn't lose typing. Keyed by campaignId so two campaigns
  // don't share drafts.
  useEffect(() => {
    if (!editOpen || typeof window === 'undefined') return
    const draftKey = `${DRAFT_STORAGE_PREFIX}${campaignId}`
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify(editForm))
    } catch {
      // Quota / disabled — ignore.
    }
  }, [editForm, editOpen, campaignId])

  // Escape closes the edit dialog without discarding the draft. The
  // project's custom Dialog has no built-in keyboard handler — wire
  // it ourselves so users have a standard close affordance alongside
  // the header X button.
  useEffect(() => {
    if (!editOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editSaving) {
        closeEditDialog(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, editSaving])

  const closeEditDialog = (clearDraft: boolean) => {
    setEditOpen(false)
    setEditErrors({})
    if (clearDraft && typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${campaignId}`)
      } catch { /* noop */ }
    }
  }

  const validateEditForm = (): Record<string, string> => {
    const errs: Record<string, string> = {}
    if (!editForm.title.trim()) {
      errs.title = 'Title is required.'
    } else if (editForm.title.trim().length > 200) {
      errs.title = 'Title must be 200 characters or fewer.'
    }
    const budgetNum = parseFloat(editForm.budgetTotal)
    if (!editForm.budgetTotal || Number.isNaN(budgetNum) || budgetNum <= 0) {
      errs.budgetTotal = 'Budget must be greater than 0.'
    }
    if (editForm.brief && editForm.brief.length > 5000) {
      errs.brief = 'Brief must be 5000 characters or fewer.'
    }
    if (editForm.startDate && editForm.endDate && editForm.endDate < editForm.startDate) {
      errs.endDate = 'End date must be on or after start date.'
    }
    if (editForm.reviewSlaHours) {
      const n = parseInt(editForm.reviewSlaHours, 10)
      if (Number.isNaN(n) || n <= 0) errs.reviewSlaHours = 'SLA hours must be a positive number.'
    }
    if (editForm.maxInfluencers) {
      const n = parseInt(editForm.maxInfluencers, 10)
      if (Number.isNaN(n) || n <= 0) errs.maxInfluencers = 'Max influencers must be a positive number.'
    }
    return errs
  }

  const submitEdit = async () => {
    if (!data?.campaign) return
    const errs = validateEditForm()
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs)
      return
    }
    setEditSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: editForm.title.trim(),
        brief: editForm.brief.trim() || null,
        budgetTotal: Math.round(parseFloat(editForm.budgetTotal) * 100),
        deliverables: editForm.deliverables.split(',').map(s => s.trim()).filter(Boolean),
        targetPlatforms: editForm.targetPlatforms.split(',').map(s => s.trim()).filter(Boolean),
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
        reviewSlaHours: editForm.reviewSlaHours
          ? parseInt(editForm.reviewSlaHours, 10)
          : null,
        autoApproveEnabled: editForm.autoApproveEnabled,
        isPublic: editForm.isPublic,
        maxInfluencers: editForm.maxInfluencers
          ? parseInt(editForm.maxInfluencers, 10)
          : null,
        applicationDeadline: editForm.applicationDeadline || null,
      }
      // Q2 — paymentType only travels for draft. Server also enforces.
      if (data.campaign.status === 'draft') {
        body.paymentType = editForm.paymentType
      }
      const res = await apiPatch(`/api/brand/campaigns/${campaignId}`, body)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save changes')
      }
      toast.success('Campaign updated')
      closeEditDialog(true)
      loadData()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save changes')
    } finally {
      setEditSaving(false)
    }
  }

  // Client-side mirror of getMissingPublishFields() in
  // campaignManagementService. Used to disable Publish + show
  // inline "complete these to publish" tooltip BEFORE the click.
  const getMissingPublishFields = (c: any): string[] => {
    if (!c) return []
    const missing: string[] = []
    if (!c.title || c.title.trim() === '') missing.push('title')
    if (!c.budgetTotal || c.budgetTotal <= 0) missing.push('budget')
    if (!c.brief || c.brief.trim() === '') missing.push('brief')
    return missing
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

  const respondToApp = async (appId: string, respondStatus: 'accepted' | 'rejected') => {
    setActing(true)
    try {
      const res = await fetch(`/api/brand/applications/${appId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: respondStatus, response: respondStatus === 'rejected' ? rejectReason : null }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(`Application ${respondStatus}`)
      setRespondingId(null)
      setRejectReason('')
      loadApplications()
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
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2 flex-wrap justify-end">
            {EDITABLE_STATUSES.has(campaign.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={openEditDialog}
                disabled={acting}
                title="Edit campaign details"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            )}
            {campaign.status === 'draft' && (() => {
              const missing = getMissingPublishFields(campaign)
              const canPublish = missing.length === 0
              return (
                <Button
                  size="sm"
                  onClick={() => openStatusConfirm('proposed')}
                  disabled={acting || !canPublish}
                  title={
                    canPublish
                      ? 'Publish to the marketplace'
                      : `Complete these fields to publish: ${missing.join(', ')}`
                  }
                >
                  <Play className="h-3.5 w-3.5 mr-1" /> Publish
                </Button>
              )
            })()}
            {['proposed', 'negotiating'].includes(campaign.status) && (
              <Button size="sm" onClick={() => openStatusConfirm('active')} disabled={acting}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Activate
              </Button>
            )}
            {campaign.status === 'active' && (
              <Button size="sm" variant="outline" onClick={() => openStatusConfirm('completed')} disabled={acting}>
                <Trophy className="h-3.5 w-3.5 mr-1" /> Complete
              </Button>
            )}
            {!['completed', 'cancelled'].includes(campaign.status) && (
              <Button size="sm" variant="destructive" onClick={() => openStatusConfirm('cancelled')} disabled={acting}>
                <Ban className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            )}
          </div>
          {campaign.status === 'draft' && (() => {
            const missing = getMissingPublishFields(campaign)
            if (missing.length === 0) return null
            return (
              <p className="text-xs text-amber-500 text-right">
                Complete to publish: {missing.join(', ')}
              </p>
            )
          })()}
        </div>
      </div>

      {/* Brief */}
      {campaign.brief && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Brief</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{campaign.brief}</p></CardContent>
        </Card>
      )}

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones ({milestones?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Payment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">

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

        </TabsContent>

        <TabsContent value="milestones" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5"><Target className="h-4 w-4" /> Milestones</CardTitle>
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
        </TabsContent>

        <TabsContent value="applications" className="space-y-4 mt-4">
          {appsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : applications.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <FileText className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">No applications yet</p>
                <p className="text-xs text-muted-foreground">
                  {campaign.isPublic ? 'Applications will appear here when influencers apply.' : 'Make this campaign public to receive applications from the marketplace.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {applications.map((app: any) => (
                <Card key={app.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{app.displayName || app.influencerName || 'Unknown'}</p>
                          {app.niche && <Badge variant="outline" className="text-[10px]">{app.niche}</Badge>}
                          <Badge className={
                            app.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            app.status === 'withdrawn' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'
                          }>{app.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Rate: {(app.proposedRate / 100).toLocaleString()} {app.proposedCurrency} | Applied: {new Date(app.appliedAt).toLocaleDateString()}
                        </p>
                        <p className="text-sm mt-2 text-muted-foreground">{app.proposalText}</p>
                      </div>
                    </div>
                    {app.status === 'pending' && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        {respondingId === app.id ? (
                          <div className="flex-1 space-y-2">
                            <Textarea
                              placeholder="Reason for rejection (optional)"
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" onClick={() => respondToApp(app.id, 'rejected')} disabled={acting}>Confirm Reject</Button>
                              <Button size="sm" variant="outline" onClick={() => { setRespondingId(null); setRejectReason('') }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Button size="sm" onClick={() => respondToApp(app.id, 'accepted')} disabled={acting}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Accept
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRespondingId(app.id)} disabled={acting}>
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    {app.brandResponse && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <span className="font-medium">Your response:</span> {app.brandResponse}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── PAYMENT TAB ──────────────────────────────────────────── */}
        <TabsContent value="payment" className="space-y-4 mt-4">
          {!paymentTabLoaded ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (() => {
            const campaign = data?.campaign
            const acceptedInfluencers = (data?.influencers ?? []).filter((i: any) => i.status === 'accepted')
            const payments: any[] = paymentSummary?.payments ?? []
            const escrowedPayment = payments.find((p: any) => p.status === 'escrowed')
            const releasedPayments = payments.filter((p: any) => p.status === 'released')
            const hasAnyPayment = payments.length > 0
            const isEscrowed = !!escrowedPayment
            const allReleased = payments.length > 0 && payments.every((p: any) => p.status === 'released')

            return (
              <>
                {/* ── Section 1: Payment Status Card ─────────────────── */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Payment Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {allReleased ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-sm">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <div>
                          <p className="font-medium">All payments released</p>
                          <p className="text-xs mt-0.5 opacity-80">
                            {formatCurrency(paymentSummary?.totalPaid ?? 0, campaign?.budgetCurrency ?? 'INR')} paid out — payouts queued for admin processing
                          </p>
                        </div>
                      </div>
                    ) : isEscrowed ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
                        <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Payment Secured in Escrow</p>
                          <p className="text-xs mt-0.5 opacity-80">
                            {formatCurrency(escrowedPayment.amount, escrowedPayment.currency)} held securely · Released when milestones are approved
                          </p>
                        </div>
                      </div>
                    ) : razorpayOrder && razorpayOrder.status === 'created' ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Payment order created. Complete your payment below to secure funds in escrow.
                        </p>
                        <RazorpayCheckout
                          orderId={razorpayOrder.id}
                          razorpayOrderId={razorpayOrder.razorpayOrderId}
                          amount={razorpayOrder.amount}
                          currency={razorpayOrder.currency}
                          campaignTitle={campaign?.title ?? ''}
                          platformFee={razorpayOrder.platformFee}
                          influencerAmount={razorpayOrder.influencerAmount}
                          feePercent={Number(campaign?.platformFeePct ?? 10)}
                          brandName={(session?.user as any)?.name ?? ''}
                          brandEmail={(session?.user as any)?.email ?? ''}
                          onSuccess={() => { toast.success('Payment confirmed! Refreshing…'); loadPaymentTab(); loadData() }}
                          onFailure={(err) => toast.error(err)}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Secure your campaign budget in escrow. Payment is released to the influencer only when milestones are approved.
                        </p>
                        <Button
                          size="sm"
                          onClick={createPaymentOrder}
                          disabled={creatingOrder || campaign?.status !== 'active'}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {creatingOrder ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <CreditCard className="h-3.5 w-3.5 mr-2" />}
                          Create Payment Order
                        </Button>
                        {campaign?.status !== 'active' && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">Campaign must be active to accept payments.</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Section 2: Milestone Release ───────────────────── */}
                {isEscrowed && milestones && milestones.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ArrowDownToLine className="h-4 w-4" /> Release Payments
                      </CardTitle>
                      <CardDescription className="text-xs">Release payment to influencer after approving each milestone.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {milestones.map((ms: any) => {
                        const msPayment = payments.find((p: any) => p.milestoneId === ms.id)
                        const isReleased = msPayment?.status === 'released'
                        const canRelease = ms.status === 'approved' && msPayment?.status === 'escrowed'
                        return (
                          <div key={ms.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{ms.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[10px]">{ms.status}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(ms.paymentAmount, campaign?.budgetCurrency ?? 'INR')}
                                </span>
                              </div>
                            </div>
                            <div className="ml-3 flex-shrink-0">
                              {isReleased && (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-[10px]">
                                  Released
                                </Badge>
                              )}
                              {canRelease && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  onClick={() => {
                                    setReleaseMilestone(ms)
                                    setReleaseInfluencerId(
                                      acceptedInfluencers.length === 1 ? acceptedInfluencers[0].influencerId : ''
                                    )
                                    setReleaseConfirmOpen(true)
                                  }}
                                >
                                  Release Payment
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* ── Section 3: Payment History ─────────────────────── */}
                {hasAnyPayment && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Payment History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="text-left pb-2 pr-3 font-medium">Date</th>
                              <th className="text-left pb-2 pr-3 font-medium">Type</th>
                              <th className="text-right pb-2 pr-3 font-medium">Amount</th>
                              <th className="text-left pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {payments.map((p: any) => (
                              <tr key={p.id}>
                                <td className="py-2 pr-3 text-muted-foreground">
                                  {new Date(p.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-2 pr-3 capitalize">{p.paymentType}</td>
                                <td className="py-2 pr-3 text-right font-medium">
                                  {formatCurrency(p.amount, p.currency)}
                                </td>
                                <td className="py-2">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      p.status === 'released' ? 'border-green-500 text-green-700' :
                                      p.status === 'escrowed' ? 'border-blue-500 text-blue-700' :
                                      p.status === 'failed'   ? 'border-red-500 text-red-700' :
                                      p.status === 'refunded' ? 'border-amber-500 text-amber-700' :
                                      ''
                                    }`}
                                  >
                                    {p.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Section 4: Refund ──────────────────────────────── */}
                {razorpayOrder && razorpayOrder.status === 'paid' && (
                  <Card className="border-red-100 dark:border-red-900">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-red-700 dark:text-red-400">Request Refund</CardTitle>
                      <CardDescription className="text-xs">Refunds are processed via Razorpay and may take 5–7 business days.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => setRefundOpen(true)}
                      >
                        Request Refund
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* ── Release Confirmation Dialog ─────────────────────── */}
                <Dialog open={releaseConfirmOpen} onOpenChange={setReleaseConfirmOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Release Payment</DialogTitle>
                    </DialogHeader>
                    {releaseMilestone && (
                      <div className="space-y-4 pt-1">
                        <p className="text-sm text-muted-foreground">
                          You are releasing{' '}
                          <span className="font-semibold text-foreground">
                            {formatCurrency(
                              (releaseMilestone.paymentAmount ?? 0) -
                              Math.round((releaseMilestone.paymentAmount ?? 0) * (Number(campaign?.platformFeePct ?? 10) / 100)),
                              campaign?.budgetCurrency ?? 'INR'
                            )}
                          </span>{' '}
                          for milestone:{' '}
                          <span className="font-semibold text-foreground">&ldquo;{releaseMilestone.title}&rdquo;</span>
                        </p>

                        {acceptedInfluencers.length > 1 ? (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Select influencer to pay *</Label>
                            <Select value={releaseInfluencerId} onValueChange={setReleaseInfluencerId}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Choose influencer…" />
                              </SelectTrigger>
                              <SelectContent>
                                {acceptedInfluencers.map((inf: any) => (
                                  <SelectItem key={inf.influencerId} value={inf.influencerId}>
                                    {inf.influencerId}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : acceptedInfluencers.length === 1 ? (
                          <p className="text-xs text-muted-foreground">
                            Paying to: <span className="font-medium text-foreground">{acceptedInfluencers[0].influencerId}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            No accepted influencers found on this campaign.
                          </p>
                        )}

                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={releasePayment}
                            disabled={releasing || !releaseInfluencerId || acceptedInfluencers.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            {releasing ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
                            Confirm Release
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setReleaseConfirmOpen(false); setReleaseMilestone(null); setReleaseInfluencerId('') }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {/* ── Refund Dialog ───────────────────────────────────── */}
                <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Refund</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Please provide a reason. Refunds take 5–7 business days to process.
                      </p>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Reason *</Label>
                        <Textarea
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                          placeholder="Describe the reason for refund…"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={requestRefund}
                          disabled={refunding || !refundReason.trim()}
                        >
                          {refunding ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
                          Submit Refund Request
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )
          })()}
        </TabsContent>
      </Tabs>

      {/* ───────── Edit campaign dialog (3D) ───────── */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEditDialog(false)  // X / outside-click: keep the draft
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Edit campaign</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Close to keep your changes for later · Discard throws them away
                </p>
              </div>
              <button
                type="button"
                aria-label="Close (keeps your draft)"
                onClick={() => closeEditDialog(false)}
                disabled={editSaving}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Summer Beauty Collab"
              />
              {editErrors.title && (
                <p className="text-xs text-destructive">{editErrors.title}</p>
              )}
            </div>

            {/* Brief */}
            <div className="space-y-1.5">
              <Label>Brief</Label>
              <Textarea
                value={editForm.brief}
                onChange={e => setEditForm(f => ({ ...f, brief: e.target.value }))}
                rows={3}
                placeholder="What this campaign is about, the tone, the target audience…"
              />
              {editErrors.brief && (
                <p className="text-xs text-destructive">{editErrors.brief}</p>
              )}
            </div>

            {/* Budget + Payment type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Budget (INR) *</Label>
                <Input
                  type="number"
                  value={editForm.budgetTotal}
                  onChange={e => setEditForm(f => ({ ...f, budgetTotal: e.target.value }))}
                  placeholder="50000"
                />
                {editErrors.budgetTotal && (
                  <p className="text-xs text-destructive">{editErrors.budgetTotal}</p>
                )}
                {/* Q3 — warn (don't block) when applications exist and
                    the budget is being changed. Brand still has full
                    authority to mutate. */}
                {(data?.applicationCount ?? 0) > 0 &&
                  editForm.budgetTotal &&
                  Math.round(parseFloat(editForm.budgetTotal) * 100) !== campaign.budgetTotal && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-600 dark:text-amber-400 flex gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      <b>{data.applicationCount}</b> influencer application
                      {data.applicationCount === 1 ? '' : 's'} exist.
                      Changing the budget may affect their assumptions.
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Payment Type</Label>
                <Select
                  value={editForm.paymentType}
                  onValueChange={(v) => setEditForm(f => ({ ...f, paymentType: v as EditFormState['paymentType'] }))}
                  disabled={campaign.status !== 'draft'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="escrow">Escrow</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                  </SelectContent>
                </Select>
                {/* Q2 — explain why this is locked once past draft */}
                {campaign.status !== 'draft' && (
                  <p className="text-[11px] text-muted-foreground">
                    Payment type can only be changed while the campaign
                    is a draft. Locked once published.
                  </p>
                )}
              </div>
            </div>

            {/* Deliverables */}
            <div className="space-y-1.5">
              <Label>Deliverables (comma-separated)</Label>
              <Input
                value={editForm.deliverables}
                onChange={e => setEditForm(f => ({ ...f, deliverables: e.target.value }))}
                placeholder="1 reel, 2 stories, 1 blog post"
              />
            </div>

            {/* Target platforms */}
            <div className="space-y-1.5">
              <Label>Target Platforms (comma-separated)</Label>
              <Input
                value={editForm.targetPlatforms}
                onChange={e => setEditForm(f => ({ ...f, targetPlatforms: e.target.value }))}
                placeholder="instagram, youtube"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                />
                {editErrors.endDate && (
                  <p className="text-xs text-destructive">{editErrors.endDate}</p>
                )}
              </div>
            </div>

            {/* Marketplace settings */}
            <div className="border-t pt-3 space-y-3">
              <p className="text-sm font-medium">Marketplace Settings</p>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">Make Public</p>
                  <p className="text-[11px] text-muted-foreground">
                    Allow influencers to discover and apply from the marketplace.
                  </p>
                </div>
                <Switch
                  checked={editForm.isPublic}
                  onCheckedChange={(checked) => setEditForm(f => ({ ...f, isPublic: checked }))}
                />
              </div>
              {editForm.isPublic && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Max Influencers</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={editForm.maxInfluencers}
                      onChange={e => setEditForm(f => ({ ...f, maxInfluencers: e.target.value }))}
                    />
                    {editErrors.maxInfluencers && (
                      <p className="text-xs text-destructive">{editErrors.maxInfluencers}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Application Deadline</Label>
                    <Input
                      type="date"
                      value={editForm.applicationDeadline}
                      onChange={e => setEditForm(f => ({ ...f, applicationDeadline: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Content Review SLA */}
            <div className="border-t pt-3 space-y-3">
              <p className="text-sm font-medium">Content Review SLA</p>
              <div className="space-y-1.5">
                <Label>Review SLA (hours)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 48"
                  value={editForm.reviewSlaHours}
                  onChange={e => setEditForm(f => ({ ...f, reviewSlaHours: e.target.value }))}
                />
                {editErrors.reviewSlaHours && (
                  <p className="text-xs text-destructive">{editErrors.reviewSlaHours}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Leave empty for no SLA. Submitted content is auto-approved when this time passes if &ldquo;Auto-approve&rdquo; is on.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">Auto-approve on SLA expiry</p>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically approve content if you don&apos;t review before the SLA expires.
                  </p>
                </div>
                <Switch
                  checked={editForm.autoApproveEnabled}
                  onCheckedChange={(checked) => setEditForm(f => ({ ...f, autoApproveEnabled: checked }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                variant="ghost"
                onClick={() => closeEditDialog(true)}
                disabled={editSaving}
              >
                Discard
              </Button>
              <Button onClick={submitEdit} disabled={editSaving}>
                {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───────── Status-transition confirm modal (3C) ───────── */}
      <Dialog open={!!pendingStatus} onOpenChange={(open) => { if (!open) setPendingStatus(null) }}>
        <DialogContent className="sm:max-w-md">
          {pendingStatus === 'proposed' && (
            <>
              <DialogHeader>
                <DialogTitle>Publish this campaign?</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-sm">
                <p className="text-muted-foreground">
                  It will be visible to influencers in the marketplace
                  and you&apos;ll start receiving applications. You can
                  always cancel later if plans change.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setPendingStatus(null)} disabled={acting}>
                  Not yet
                </Button>
                <Button onClick={executeStatusChange} disabled={acting}>
                  {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Publish
                </Button>
              </div>
            </>
          )}

          {pendingStatus === 'active' && (
            <>
              <DialogHeader>
                <DialogTitle>Activate this campaign?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">
                Moves the campaign to <b>active</b>. Influencers you&apos;ve
                accepted can start submitting deliverables, and payments
                can be escrowed against milestones.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setPendingStatus(null)} disabled={acting}>
                  Cancel
                </Button>
                <Button onClick={executeStatusChange} disabled={acting}>
                  {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Activate
                </Button>
              </div>
            </>
          )}

          {pendingStatus === 'completed' && (
            <>
              <DialogHeader>
                <DialogTitle>Mark this campaign complete?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">
                Marks the campaign as finished. Influencers and brands
                can leave reviews. This is irreversible — make sure all
                milestones are paid out first.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setPendingStatus(null)} disabled={acting}>
                  Not yet
                </Button>
                <Button onClick={executeStatusChange} disabled={acting}>
                  {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
                  Mark complete
                </Button>
              </div>
            </>
          )}

          {pendingStatus === 'cancelled' && (() => {
            // Count active influencer assignments — cancellation will
            // notify them (eventBus side-effects). Warn explicitly.
            const activeInfluencers = (influencers ?? []).filter(
              (i: any) => ['accepted', 'active', 'invited'].includes(i.status)
            ).length
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Cancel this campaign?</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  {activeInfluencers > 0 && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600">
                      <b>{activeInfluencers}</b> influencer
                      {activeInfluencers === 1 ? '' : 's'} {activeInfluencers === 1 ? 'is' : 'are'} currently
                      working on this campaign. Cancelling will notify
                      them.
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="cancelReason" className="text-sm">
                      Reason <span className="text-muted-foreground text-xs">(optional, recommended)</span>
                    </Label>
                    <Textarea
                      id="cancelReason"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g. Budget changes, scope reduction, project paused"
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setPendingStatus(null)} disabled={acting}>
                    Keep campaign
                  </Button>
                  <Button variant="destructive" onClick={executeStatusChange} disabled={acting}>
                    {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                    Cancel campaign
                  </Button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

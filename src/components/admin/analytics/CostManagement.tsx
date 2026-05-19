'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { apiPost, apiPut, apiDelete } from '@/lib/api-client'
import { formatCurrency } from '@/lib/currency'
import { COST_CATEGORIES, type CostCategory } from '@/lib/types/platformAnalytics'

interface CostRow {
  id: string
  category: CostCategory
  description: string | null
  amount: number              // paise
  currency: string
  isRecurring: boolean
  enteredBy: string | null
  createdAt: string
  updatedAt: string
}

interface CostsResponse {
  month: string
  costs: CostRow[]
  totalsByCategory: Record<string, number>
  grandTotal: number
}

const CATEGORY_LABELS: Record<CostCategory, string> = {
  hosting: 'Hosting',
  database: 'Database',
  ai_api: 'AI API',
  email_service: 'Email',
  sms_whatsapp: 'SMS / WhatsApp',
  cdn_storage: 'CDN / Storage',
  payment_gateway: 'Payment gateway',
  marketing: 'Marketing',
  salaries: 'Salaries',
  legal: 'Legal',
  office: 'Office',
  tools_subscriptions: 'Tools / SaaS',
  other: 'Other',
}

// ── Helpers ──────────────────────────────────────────────────────

function firstOfMonthIso(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function lastNMonthIsos(n: number): string[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    return d.toISOString().slice(0, 10)
  })
}

function formatMonthLong(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function toPaise(rupeesStr: string): number | null {
  const r = Number(rupeesStr)
  if (!Number.isFinite(r) || r < 0) return null
  return Math.round(r * 100)
}

// ── Inline form draft state ──────────────────────────────────────

interface Draft {
  category: CostCategory | ''
  description: string
  amountRupees: string
  isRecurring: boolean
}

const EMPTY_DRAFT: Draft = {
  category: '',
  description: '',
  amountRupees: '',
  isRecurring: true,
}

// ────────────────────────────────────────────────────────────────────

export function CostManagement() {
  const monthOptions = useMemo(() => lastNMonthIsos(12), [])
  const [month, setMonth] = useState<string>(monthOptions[0])
  const [rows, setRows] = useState<CostRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Load costs for the selected month
  const load = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/platform-analytics/costs?month=${m.slice(0, 7)}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as CostsResponse
      setRows(data.costs)
      setGrandTotal(data.grandTotal)
    } catch (err) {
      console.error('[CostManagement] load failed', err)
      toast.error('Failed to load costs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(month)
  }, [month, load])

  // Add ──────────────────────────────────────────────────────────
  const submitAdd = async () => {
    if (!draft.category) {
      toast.error('Pick a category')
      return
    }
    const amount = toPaise(draft.amountRupees)
    if (amount == null) {
      toast.error('Amount must be a positive number (in rupees)')
      return
    }
    setBusy(true)
    try {
      const res = await apiPost('/api/admin/platform-analytics/costs', {
        month: month.slice(0, 7),
        category: draft.category,
        description: draft.description || null,
        amount,
        isRecurring: draft.isRecurring,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      toast.success('Cost added')
      setAdding(false)
      setDraft(EMPTY_DRAFT)
      await load(month)
    } catch (err) {
      console.error('[CostManagement] add failed', err)
      toast.error(err instanceof Error ? err.message : 'Failed to add cost')
    } finally {
      setBusy(false)
    }
  }

  // Edit ──────────────────────────────────────────────────────────
  const startEdit = (row: CostRow) => {
    setEditingId(row.id)
    setEditDraft({
      category: row.category,
      description: row.description ?? '',
      amountRupees: (row.amount / 100).toString(),
      isRecurring: row.isRecurring,
    })
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(EMPTY_DRAFT)
  }
  const submitEdit = async () => {
    if (!editingId) return
    if (!editDraft.category) {
      toast.error('Pick a category')
      return
    }
    const amount = toPaise(editDraft.amountRupees)
    if (amount == null) {
      toast.error('Amount must be a positive number (in rupees)')
      return
    }
    setBusy(true)
    try {
      const res = await apiPut(`/api/admin/platform-analytics/costs/${editingId}`, {
        category: editDraft.category,
        description: editDraft.description || null,
        amount,
        isRecurring: editDraft.isRecurring,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      toast.success('Cost updated')
      cancelEdit()
      await load(month)
    } catch (err) {
      console.error('[CostManagement] edit failed', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update cost')
    } finally {
      setBusy(false)
    }
  }

  // Delete ─────────────────────────────────────────────────────────
  const submitDelete = async () => {
    if (!confirmDeleteId) return
    setBusy(true)
    try {
      const res = await apiDelete(`/api/admin/platform-analytics/costs/${confirmDeleteId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      toast.success('Cost removed')
      setConfirmDeleteId(null)
      await load(month)
    } catch (err) {
      console.error('[CostManagement] delete failed', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete cost')
    } finally {
      setBusy(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Manage monthly costs</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={month} onValueChange={setMonth} disabled={loading}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">{formatMonthLong(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdding((x) => !x)}
              disabled={loading || busy}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> {adding ? 'Cancel' : 'Add cost'}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          Costs feed the cost-breakdown donut, monthly snapshot, and burn / runway calc.
          Salaries / legal lines are visible to all admins — manage who has admin access accordingly.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {/* Add form */}
        {adding && (
          <div className="border-b border-border bg-muted/30 px-4 py-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto_auto] gap-2 items-end">
              <div>
                <Label className="text-[11px] text-muted-foreground">Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft((d) => ({ ...d, category: v as CostCategory }))}
                  disabled={busy}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Pick…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COST_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Description (optional)</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Vercel Pro · 4 seats"
                  className="h-9 text-xs"
                  disabled={busy}
                  maxLength={500}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Amount (₹)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  value={draft.amountRupees}
                  onChange={(e) => setDraft((d) => ({ ...d, amountRupees: e.target.value }))}
                  placeholder="2500"
                  className="h-9 text-xs tabular-nums"
                  disabled={busy}
                />
              </div>
              <div className="flex flex-col items-start gap-1">
                <Label className="text-[11px] text-muted-foreground">Recurring</Label>
                <Switch
                  checked={draft.isRecurring}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, isRecurring: v }))}
                  disabled={busy}
                />
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={submitAdd} disabled={busy}>
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/50">
                <th className="text-left font-medium px-3 py-2">Category</th>
                <th className="text-left font-medium px-2 py-2">Description</th>
                <th className="text-right font-medium px-2 py-2">Amount</th>
                <th className="text-center font-medium px-2 py-2">Recurring</th>
                <th className="text-right font-medium px-3 py-2 w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No costs entered for {formatMonthLong(month)} yet.</td></tr>
              ) : (
                rows.map((row) => {
                  const isEditing = editingId === row.id
                  if (isEditing) {
                    return (
                      <tr key={row.id} className="border-t border-border/50 bg-muted/20">
                        <td className="px-3 py-2">
                          <Select
                            value={editDraft.category}
                            onValueChange={(v) => setEditDraft((d) => ({ ...d, category: v as CostCategory }))}
                            disabled={busy}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {COST_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c} className="text-xs">{CATEGORY_LABELS[c]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={editDraft.description}
                            onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                            className="h-8 text-xs"
                            disabled={busy}
                            maxLength={500}
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={editDraft.amountRupees}
                            onChange={(e) => setEditDraft((d) => ({ ...d, amountRupees: e.target.value }))}
                            className="h-8 text-xs tabular-nums text-right"
                            disabled={busy}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Switch
                            checked={editDraft.isRecurring}
                            onCheckedChange={(v) => setEditDraft((d) => ({ ...d, isRecurring: v }))}
                            disabled={busy}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={submitEdit} disabled={busy} aria-label="Save">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-emerald-500" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} disabled={busy} aria-label="Cancel">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={row.id} className="border-t border-border/50">
                      <td className="px-3 py-2 text-foreground whitespace-nowrap">{CATEGORY_LABELS[row.category]}</td>
                      <td className="px-2 py-2 text-muted-foreground truncate max-w-[300px]" title={row.description ?? ''}>{row.description || '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-foreground">{formatCurrency(row.amount)}</td>
                      <td className="px-2 py-2 text-center text-muted-foreground">
                        {row.isRecurring ? <span className="text-emerald-500">●</span> : <span className="text-muted-foreground/60">○</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(row)} aria-label="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setConfirmDeleteId(row.id)} aria-label="Delete">
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border bg-muted/20">
                  <td className="px-3 py-2 text-muted-foreground uppercase tracking-wider text-[10px]" colSpan={2}>Total {formatMonthLong(month)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-foreground">{formatCurrency(grandTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>

      {/* Delete confirm */}
      <AlertDialog open={confirmDeleteId != null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this cost entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the row. It cannot be undone. Recompute the financial snapshot afterwards if you've already locked in this month.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitDelete} disabled={busy} className={cn('bg-rose-500 hover:bg-rose-600 text-white')}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

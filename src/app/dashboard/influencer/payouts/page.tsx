'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Loader2, Plus, Star, Trash2, CreditCard, Smartphone,
  Globe, CheckCircle, AlertCircle, Wallet, ArrowDownToLine,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, getSupportedCurrencies } from '@/lib/currency'

// ── Types ─────────────────────────────────────────────────────────

type AccountType = 'bank_account' | 'upi' | 'paypal' | 'wise' | 'swift'
type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface PayoutAccount {
  id: string
  accountType: AccountType
  userRole: string
  currency: string
  isPrimary: boolean
  isVerified: boolean
  accountHolderName: string | null
  accountNumberMasked: string | null
  ifscCode: string | null
  upiId: string | null
  paypalEmail: string | null
  wiseEmail: string | null
  swiftCode: string | null
  ibanMasked: string | null
  bankName: string | null
  bankCountry: string | null
  createdAt: string
}

interface Payout {
  id: string
  campaignId: string | null
  amount: number
  currency: string
  payoutMethod: string
  status: PayoutStatus
  failureReason?: string | null
  retryCount: number
  initiatedAt: string | null
  completedAt: string | null
  createdAt: string
}

// ── Icons & display helpers ───────────────────────────────────────

function AccountIcon({ type }: { type: AccountType }) {
  const cls = 'h-5 w-5 flex-shrink-0'
  switch (type) {
    case 'bank_account': return <span className={`${cls} text-lg`}>🏦</span>
    case 'upi':          return <span className={`${cls} text-lg`}>📱</span>
    case 'paypal':       return <span className={`${cls} text-lg`}>🅿️</span>
    case 'wise':         return <span className={`${cls} text-lg`}>💙</span>
    case 'swift':        return <span className={`${cls} text-lg`}>🌐</span>
  }
}

function accountTypeLabel(type: AccountType): string {
  return {
    bank_account: 'Bank Account',
    upi: 'UPI',
    paypal: 'PayPal',
    wise: 'Wise',
    swift: 'SWIFT / International',
  }[type]
}

function accountSubtitle(acc: PayoutAccount): string {
  switch (acc.accountType) {
    case 'bank_account':
      return [acc.accountHolderName, acc.accountNumberMasked, acc.ifscCode].filter(Boolean).join(' · ')
    case 'upi':
      return acc.upiId ?? ''
    case 'paypal':
      return acc.paypalEmail ?? ''
    case 'wise':
      return [acc.wiseEmail, acc.currency].filter(Boolean).join(' · ')
    case 'swift':
      return [acc.swiftCode, acc.bankCountry].filter(Boolean).join(' · ')
  }
}

function methodLabel(method: string): string {
  return {
    razorpay_payout: 'Razorpay',
    wise_manual:     'Wise Transfer',
    paypal_manual:   'PayPal',
    bank_manual:     'Bank Transfer',
  }[method] ?? method
}

const STATUS_STYLES: Record<PayoutStatus, string> = {
  pending:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  completed:  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  failed:     'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const COUNTRIES = [
  'United States', 'United Kingdom', 'European Union', 'United Arab Emirates',
  'Singapore', 'Australia', 'Canada', 'Japan', 'Brazil', 'Germany',
  'France', 'Netherlands', 'Other',
]

// ── Add Account Form state ────────────────────────────────────────

const EMPTY_FORM = {
  accountType: '' as AccountType | '',
  currency: 'INR',
  isPrimary: false,
  // bank
  accountHolderName: '',
  accountNumber: '',
  ifscCode: '',
  // upi
  upiId: '',
  // paypal
  paypalEmail: '',
  // wise
  wiseEmail: '',
  // swift
  swiftCode: '',
  iban: '',
  bankName: '',
  bankCountry: '',
}

// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

export default function InfluencerPayoutsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Accounts tab
  const [accounts, setAccounts] = useState<PayoutAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PayoutAccount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null)

  // History tab
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payoutsLoading, setPayoutsLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const currencies = getSupportedCurrencies()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  // Load accounts on mount
  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    try {
      const res = await fetch('/api/payouts/accounts')
      if (res.ok) {
        const { accounts: data } = await res.json()
        setAccounts(data ?? [])
      }
    } catch {
      toast.error('Failed to load payout accounts')
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') loadAccounts()
  }, [status, loadAccounts])

  // Load payout history (lazy)
  const loadHistory = useCallback(async () => {
    setPayoutsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/influencer/payouts?${params}`)
      if (res.ok) {
        const { payouts: data } = await res.json()
        setPayouts(data ?? [])
      }
    } catch {
      toast.error('Failed to load payout history')
    } finally {
      setPayoutsLoading(false)
    }
  }, [page, statusFilter])

  const onTabChange = (tab: string) => {
    if (tab === 'history' && !historyLoaded) {
      setHistoryLoaded(true)
      loadHistory()
    }
  }

  useEffect(() => {
    if (historyLoaded) loadHistory()
  }, [statusFilter, page, historyLoaded, loadHistory])

  // ── Add account ────────────────────────────────────────────────
  const handleAddAccount = async () => {
    if (!form.accountType) { toast.error('Select an account type'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/payouts/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Payout account added')
      setAddOpen(false)
      setForm({ ...EMPTY_FORM })
      loadAccounts()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add account')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Set primary ────────────────────────────────────────────────
  const handleSetPrimary = async (id: string) => {
    setSettingPrimary(id)
    try {
      const res = await fetch(`/api/payouts/accounts/${id}/primary`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Primary account updated')
      loadAccounts()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSettingPrimary(null)
    }
  }

  // ── Delete account ─────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/payouts/accounts/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Account removed')
      setDeleteTarget(null)
      loadAccounts()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  // ── Payout totals ──────────────────────────────────────────────
  const completedPayouts = payouts.filter(p => p.status === 'completed')
  const pendingPayouts   = payouts.filter(p => p.status === 'pending' || p.status === 'processing')
  const thisMonth = completedPayouts.filter(p => {
    const d = new Date(p.completedAt ?? p.createdAt)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <Wallet className="h-6 w-6" /> Payouts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage where you receive campaign payments
        </p>
      </div>

      <Tabs defaultValue="accounts" onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="accounts">Payout Accounts</TabsTrigger>
          <TabsTrigger value="history">Payout History</TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════
            PAYOUT ACCOUNTS TAB
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="accounts" className="space-y-4 mt-4">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {accounts.length} of 5 accounts
            </p>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={accounts.length >= 5}
                  title={accounts.length >= 5 ? 'Maximum 5 accounts reached' : undefined}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Payout Account</DialogTitle>
                </DialogHeader>
                <AddAccountForm
                  form={form}
                  setForm={setForm}
                  currencies={currencies}
                  onSubmit={handleAddAccount}
                  submitting={submitting}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Max limit warning */}
          {accounts.length >= 5 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Maximum 5 accounts reached. Delete an account to add a new one.</span>
            </div>
          )}

          {/* Accounts list */}
          {accountsLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <ArrowDownToLine className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">No payout accounts yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a bank account, UPI, or international account to receive campaign payments
                  </p>
                </div>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Your First Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => (
                <Card key={acc.id} className={acc.isPrimary ? 'ring-1 ring-indigo-500' : ''}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <AccountIcon type={acc.accountType} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                            <span className="font-medium text-sm">{accountTypeLabel(acc.accountType)}</span>
                            <Badge variant="outline" className="text-[10px] h-4">{acc.currency}</Badge>
                            {acc.isPrimary && (
                              <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 text-[10px] h-4">
                                Primary
                              </Badge>
                            )}
                            {acc.isVerified && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px] h-4">
                                <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Verified
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{accountSubtitle(acc)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!acc.isPrimary && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={settingPrimary === acc.id}
                            onClick={() => handleSetPrimary(acc.id)}
                          >
                            {settingPrimary === acc.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><Star className="h-3 w-3 mr-1" />Primary</>
                            }
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          disabled={acc.isPrimary}
                          title={acc.isPrimary ? 'Set another account as primary first' : 'Remove account'}
                          onClick={() => setDeleteTarget(acc)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            PAYOUT HISTORY TAB
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="history" className="space-y-4 mt-4">

          {/* Summary cards */}
          {!payoutsLoading && payouts.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-lg font-bold">
                    {completedPayouts.reduce((s, p) => s + p.amount, 0) > 0
                      ? formatCurrency(completedPayouts.reduce((s, p) => s + p.amount, 0), completedPayouts[0]?.currency ?? 'INR')
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Received</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-lg font-bold">
                    {pendingPayouts.reduce((s, p) => s + p.amount, 0) > 0
                      ? formatCurrency(pendingPayouts.reduce((s, p) => s + p.amount, 0), pendingPayouts[0]?.currency ?? 'INR')
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-lg font-bold">
                    {thisMonth.reduce((s, p) => s + p.amount, 0) > 0
                      ? formatCurrency(thisMonth.reduce((s, p) => s + p.amount, 0), thisMonth[0]?.currency ?? 'INR')
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">This Month</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {payoutsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : payouts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Wallet className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">No payouts yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete campaign milestones to receive payments
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Method</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payouts.map(p => (
                        <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-semibold">{formatCurrency(p.amount, p.currency)}</span>
                            <span className="text-xs text-muted-foreground ml-1">{p.currency}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {methodLabel(p.payoutMethod)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <Badge className={`text-[10px] ${STATUS_STYLES[p.status]}`}>
                                {p.status}
                              </Badge>
                              {p.status === 'failed' && p.failureReason && (
                                <p className="text-[11px] text-red-600 dark:text-red-400 max-w-[200px] truncate">
                                  {p.failureReason} ·{' '}
                                  <a href="mailto:support@earn4insights.com" className="underline">
                                    Contact support
                                  </a>
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {p.completedAt
                              ? new Date(p.completedAt).toLocaleDateString()
                              : new Date(p.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">Page {page}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={payouts.length < PAGE_SIZE}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Delete confirmation ──────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove payout account?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove your {deleteTarget ? accountTypeLabel(deleteTarget.accountType) : ''} account
              {deleteTarget?.upiId ? ` (${deleteTarget.upiId})` : ''}
              {deleteTarget?.paypalEmail ? ` (${deleteTarget.paypalEmail})` : ''}
              ? This cannot be undone. Any pending payouts to this account will still be processed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              Remove Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ADD ACCOUNT FORM (extracted to keep page readable)
// ═══════════════════════════════════════════════════════════════════

function AddAccountForm({
  form,
  setForm,
  currencies,
  onSubmit,
  submitting,
}: {
  form: typeof EMPTY_FORM
  setForm: (f: typeof EMPTY_FORM) => void
  currencies: ReturnType<typeof getSupportedCurrencies>
  onSubmit: () => void
  submitting: boolean
}) {
  const set = (key: keyof typeof EMPTY_FORM, value: any) =>
    setForm({ ...form, [key]: value })

  return (
    <div className="space-y-4 pt-1">
      {/* Account type */}
      <div className="space-y-1.5">
        <Label className="text-xs">Account type *</Label>
        <Select
          value={form.accountType}
          onValueChange={v => set('accountType', v as AccountType)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select type…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bank_account">🏦 Bank Account (India)</SelectItem>
            <SelectItem value="upi">📱 UPI</SelectItem>
            <SelectItem value="paypal">🅿️ PayPal</SelectItem>
            <SelectItem value="wise">💙 Wise</SelectItem>
            <SelectItem value="swift">🌐 SWIFT / International</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Currency */}
      <div className="space-y-1.5">
        <Label className="text-xs">Currency *</Label>
        <Select value={form.currency} onValueChange={v => set('currency', v)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencies.map(c => (
              <SelectItem key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dynamic fields */}
      {form.accountType === 'bank_account' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Account holder name *</Label>
            <Input
              value={form.accountHolderName}
              onChange={e => set('accountHolderName', e.target.value)}
              placeholder="Full name as on bank account"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Account number *</Label>
            <Input
              type="password"
              value={form.accountNumber}
              onChange={e => set('accountNumber', e.target.value)}
              placeholder="Account number"
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Stored encrypted. Only last 4 digits will be shown.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">IFSC code * (11 characters)</Label>
            <Input
              value={form.ifscCode}
              onChange={e => set('ifscCode', e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
              maxLength={11}
              className="h-9 text-sm font-mono"
            />
          </div>
        </>
      )}

      {form.accountType === 'upi' && (
        <div className="space-y-1.5">
          <Label className="text-xs">UPI ID * (e.g. name@upi)</Label>
          <Input
            value={form.upiId}
            onChange={e => set('upiId', e.target.value)}
            placeholder="yourname@upi"
            className="h-9 text-sm"
          />
        </div>
      )}

      {form.accountType === 'paypal' && (
        <div className="space-y-1.5">
          <Label className="text-xs">PayPal email *</Label>
          <Input
            type="email"
            value={form.paypalEmail}
            onChange={e => set('paypalEmail', e.target.value)}
            placeholder="you@example.com"
            className="h-9 text-sm"
          />
        </div>
      )}

      {form.accountType === 'wise' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Wise email *</Label>
          <Input
            type="email"
            value={form.wiseEmail}
            onChange={e => set('wiseEmail', e.target.value)}
            placeholder="you@example.com"
            className="h-9 text-sm"
          />
        </div>
      )}

      {form.accountType === 'swift' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">SWIFT / BIC code * (8 or 11 chars)</Label>
            <Input
              value={form.swiftCode}
              onChange={e => set('swiftCode', e.target.value.toUpperCase())}
              placeholder="e.g. HDFCINBB"
              maxLength={11}
              className="h-9 text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">IBAN *</Label>
            <Input
              type="password"
              value={form.iban}
              onChange={e => set('iban', e.target.value.toUpperCase())}
              placeholder="IBAN number"
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Stored encrypted. Only last 4 digits will be shown.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bank name *</Label>
            <Input
              value={form.bankName}
              onChange={e => set('bankName', e.target.value)}
              placeholder="Name of your bank"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bank country *</Label>
            <Select value={form.bankCountry} onValueChange={v => set('bankCountry', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select country…" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Set as primary toggle */}
      {form.accountType && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPrimary"
            checked={form.isPrimary}
            onChange={e => set('isPrimary', e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="isPrimary" className="text-xs cursor-pointer">
            Set as primary account for {form.currency}
          </Label>
        </div>
      )}

      <Separator />

      <Button
        onClick={onSubmit}
        disabled={submitting || !form.accountType}
        className="w-full"
        size="sm"
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
        Add Account
      </Button>
    </div>
  )
}

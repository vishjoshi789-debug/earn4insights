'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Loader2, Gift, Trophy, Star, CheckCircle, Wallet, CreditCard,
  Tag, AlertCircle, IndianRupee, ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────

type RewardItem = {
  id: string; name: string; description: string | null
  pointsCost: number; stock: number | null; isActive: boolean
}
type ChallengeItem = {
  id: string; title: string; description: string | null
  pointsReward: number; targetCount: number; sourceType: string
  currentCount: number; completed: boolean
}
type PointTransaction = {
  id: string; amount: number; type: string
  source: string; description: string | null; createdAt: string
}
type PayoutAccount = {
  id: string; accountType: string; currency: string; isPrimary: boolean
  upiId?: string; paypalEmail?: string; wiseEmail?: string
  accountHolderName?: string
}
type Redemption = {
  id: string; points: number; value: number; currency: string
  redemptionType: string; status: string; voucherCode: string | null
  createdAt: string
}
type RedemptionType = 'platform_credits' | 'voucher' | 'cash_payout'

// ── Constants ──────────────────────────────────────────────────────

const POINTS_TO_INR = 0.10   // ₹0.10 per point (10 pts = ₹1, matches API POINTS_PER_INR = 10)
const MINS: Record<RedemptionType, number> = {
  platform_credits: 100,
  voucher: 200,
  cash_payout: 500,
}

const REDEMPTION_LABELS: Record<RedemptionType, string> = {
  platform_credits: 'Platform Credits',
  voucher: 'Discount Voucher',
  cash_payout: 'Cash Payout',
}

// ── Helpers ────────────────────────────────────────────────────────

function ptToRupees(pts: number) {
  return `₹${(pts * POINTS_TO_INR).toFixed(2)}`
}

function accountLabel(acc: PayoutAccount): string {
  switch (acc.accountType) {
    case 'upi':      return `UPI — ${acc.upiId}`
    case 'paypal':   return `PayPal — ${acc.paypalEmail}`
    case 'wise':     return `Wise — ${acc.wiseEmail} (${acc.currency})`
    default:         return `Bank — ${acc.accountHolderName ?? 'Account'}`
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:    'bg-amber-900/50 text-amber-300',
    processing: 'bg-blue-900/50 text-blue-300',
    completed:  'bg-green-900/50 text-green-300',
    failed:     'bg-red-900/50 text-red-400',
  }
  return (
    <Badge className={map[status] ?? 'bg-muted text-muted-foreground'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

// ── Redemption Card ────────────────────────────────────────────────

function RedemptionCard({
  type, icon, title, description, minPoints, balance,
  payoutAccounts, onRedeem,
}: {
  type: RedemptionType
  icon: React.ReactNode
  title: string
  description: string
  minPoints: number
  balance: number
  payoutAccounts: PayoutAccount[]
  onRedeem: (type: RedemptionType, pts: number, accountId?: string) => void
}) {
  const [pts, setPts] = useState('')
  const [accountId, setAccountId] = useState('')

  const parsed = parseInt(pts, 10)
  const valid = !isNaN(parsed) && parsed >= minPoints && parsed <= balance
  const rupeeValue = !isNaN(parsed) && parsed > 0 ? ptToRupees(parsed) : null

  const needsAccount = type === 'cash_payout'

  const canSubmit = valid && (!needsAccount || accountId !== '')

  return (
    <Card className="flex flex-col">
      <CardContent className="pt-5 pb-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-2">
          <div className="mt-0.5">{icon}</div>
          <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-xs">Points to redeem <span className="text-muted-foreground">(min {minPoints})</span></Label>
            <Input
              type="number"
              min={minPoints}
              max={balance}
              placeholder={`${minPoints}+`}
              value={pts}
              onChange={e => setPts(e.target.value)}
              className="h-8 text-sm"
            />
            {rupeeValue && (
              <p className="text-xs text-indigo-400 font-medium flex items-center gap-1">
                <IndianRupee className="h-3 w-3" />{rupeeValue.replace('₹', '')} value
              </p>
            )}
          </div>

          {needsAccount && (
            <div className="space-y-1">
              <Label className="text-xs">Payout account</Label>
              {payoutAccounts.length === 0 ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 p-2 rounded-md bg-muted">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>No accounts. <Link href="/dashboard/influencer/payouts" className="text-indigo-500 underline">Add one →</Link></span>
                </div>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-8 text-xs bg-background text-foreground">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="bg-background text-foreground">
                    {payoutAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">{accountLabel(acc)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {type === 'cash_payout' && (
          <p className="text-[11px] text-muted-foreground">Processing: 3–5 business days</p>
        )}
        {type === 'platform_credits' && (
          <p className="text-[11px] text-muted-foreground">Processed instantly</p>
        )}
        {type === 'voucher' && (
          <p className="text-[11px] text-muted-foreground">Voucher code generated on redemption</p>
        )}

        <Button
          size="sm"
          className="w-full mt-auto bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!canSubmit}
          onClick={() => onRedeem(type, parsed, accountId || undefined)}
        >
          Redeem <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────────────────

export default function RewardsPage() {
  const [balance, setBalance]             = useState(0)
  const [lifetimePoints, setLifetimePoints] = useState(0)
  const [catalog, setCatalog]             = useState<RewardItem[]>([])
  const [challenges, setChallenges]       = useState<ChallengeItem[]>([])
  const [transactions, setTransactions]   = useState<PointTransaction[]>([])
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([])
  const [redemptions, setRedemptions]     = useState<Redemption[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)

  // Catalog redemption
  const [redeeming, setRedeeming] = useState<string | null>(null)

  // New redemption form
  const [confirmPayload, setConfirmPayload] = useState<{
    type: RedemptionType; points: number; accountId?: string
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rewardsRes, challengesRes, pointsRes, accountsRes, redemptionsRes] = await Promise.all([
        fetch('/api/rewards'),
        fetch('/api/challenges'),
        fetch('/api/user/points'),
        fetch('/api/payouts/accounts'),
        fetch('/api/consumer/payment-history'),
      ])
      const [rewardsData, challengesData, pointsData, accountsData, redemptionsData] = await Promise.all([
        rewardsRes.json(),
        challengesRes.json(),
        pointsRes.json(),
        accountsRes.ok ? accountsRes.json() : { accounts: [] },
        redemptionsRes.ok ? redemptionsRes.json() : { redemptions: [] },
      ])

      if (!rewardsRes.ok)    throw new Error(rewardsData.error   || 'Failed to load rewards')
      if (!challengesRes.ok) throw new Error(challengesData.error || 'Failed to load challenges')
      if (!pointsRes.ok)     throw new Error(pointsData.error    || 'Failed to load points')

      setCatalog(rewardsData.catalog || [])
      setChallenges(challengesData.challenges || [])
      setBalance(pointsData.balance?.totalPoints ?? rewardsData.balance ?? 0)
      setLifetimePoints(pointsData.balance?.lifetimePoints ?? 0)
      setTransactions((pointsData.transactions || []).slice(0, 10))
      setPayoutAccounts(accountsData.accounts || [])
      setRedemptions(redemptionsData.redemptions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  // ── Catalog redeem (existing) ──────────────────────────────────
  const handleCatalogRedeem = async (rewardId: string) => {
    setRedeeming(rewardId)
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      })
      const data = await res.json()
      if (res.ok) {
        setBalance(data.newBalance)
        toast.success('Reward redeemed successfully!')
        await loadData()
      } else {
        throw new Error(data.error || 'Failed to redeem reward')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to redeem reward')
    } finally {
      setRedeeming(null)
    }
  }

  // ── New points redemption ──────────────────────────────────────
  const handleRedemptionRequest = (type: RedemptionType, points: number, accountId?: string) => {
    setConfirmPayload({ type, points, accountId })
  }

  const handleConfirmRedemption = async () => {
    if (!confirmPayload) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/consumer/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: confirmPayload.points,
          redemptionType: confirmPayload.type,
          payoutAccountId: confirmPayload.accountId,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(
          confirmPayload.type === 'platform_credits'
            ? 'Credits added instantly!'
            : confirmPayload.type === 'voucher'
            ? 'Voucher redemption submitted!'
            : 'Payout request submitted! Expect 3–5 business days.',
          { duration: 5000 }
        )
        setConfirmPayload(null)
        await loadData()
      } else {
        throw new Error(data.error || 'Redemption failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Redemption failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Section 1: Points Balance ── */}
      <Card className="bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border-indigo-900/50">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5 mb-1">
                <Star className="h-4 w-4 text-amber-500" /> Available Balance
              </p>
              <p className="text-5xl font-bold tracking-tight">{balance.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">pts</p>
              <p className="text-lg font-semibold text-indigo-400 mt-2 flex items-center gap-1">
                <IndianRupee className="h-4 w-4" />{(balance * POINTS_TO_INR).toFixed(2)} cash value
              </p>
            </div>
            <div className="text-sm space-y-1.5 text-muted-foreground">
              <p>Lifetime earned: <span className="font-medium text-foreground">{lifetimePoints.toLocaleString()} pts</span></p>
              <p>Rate: 1 pt = ₹{POINTS_TO_INR}</p>
              <Link
                href="/dashboard/feedback"
                className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-600 font-medium text-xs mt-2"
              >
                Earn more points <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Redeem Points ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-indigo-500" />
          Redeem Points
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <RedemptionCard
            type="platform_credits"
            icon={<CreditCard className="h-5 w-5 text-indigo-500" />}
            title="Platform Credits"
            description="Use points as platform currency for premium features and surveys"
            minPoints={MINS.platform_credits}
            balance={balance}
            payoutAccounts={payoutAccounts}
            onRedeem={handleRedemptionRequest}
          />
          <RedemptionCard
            type="voucher"
            icon={<Tag className="h-5 w-5 text-purple-500" />}
            title="Discount Voucher"
            description="Redeem for discount codes on partner brands and products"
            minPoints={MINS.voucher}
            balance={balance}
            payoutAccounts={payoutAccounts}
            onRedeem={handleRedemptionRequest}
          />
          <RedemptionCard
            type="cash_payout"
            icon={<Wallet className="h-5 w-5 text-green-500" />}
            title="Cash Payout"
            description="Withdraw to your bank account or UPI — 3–5 business days"
            minPoints={MINS.cash_payout}
            balance={balance}
            payoutAccounts={payoutAccounts}
            onRedeem={handleRedemptionRequest}
          />
        </div>
      </section>

      {/* ── Confirm Dialog ── */}
      <Dialog open={!!confirmPayload} onOpenChange={open => { if (!open && !submitting) setConfirmPayload(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Redemption</DialogTitle>
          </DialogHeader>
          {confirmPayload && (
            <div className="space-y-4 py-2">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{REDEMPTION_LABELS[confirmPayload.type]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Points used</span>
                  <span className="font-medium">{confirmPayload.points.toLocaleString()} pts</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Value received</span>
                  <span className="text-indigo-400">
                    ₹{(confirmPayload.points * POINTS_TO_INR).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Remaining balance</span>
                  <span>{(balance - confirmPayload.points).toLocaleString()} pts</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmPayload(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleConfirmRedemption}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Redemption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Section 3: Challenges ── */}
      {challenges.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Challenges
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {challenges.map(c => {
              const pct = Math.min(100, Math.round((c.currentCount / c.targetCount) * 100))
              return (
                <Card key={c.id} className={c.completed ? 'border-green-800' : ''}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{c.title}</h3>
                      {c.completed
                        ? <Badge className="bg-green-900/50 text-green-300"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>
                        : <Badge variant="outline">{c.pointsReward} pts</Badge>
                      }
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{c.currentCount} / {c.targetCount}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Section 4: Reward Catalog ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Gift className="h-5 w-5 text-indigo-500" /> Reward Catalog
        </h2>
        {catalog.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No rewards available yet.</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalog.map(reward => {
              const inStock = reward.stock === null || reward.stock > 0
              const canAfford = balance >= reward.pointsCost
              return (
                <Card key={reward.id}>
                  <CardHeader><CardTitle className="text-base">{reward.name}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {reward.description && <p className="text-sm text-muted-foreground">{reward.description}</p>}
                    <p className="text-sm">Cost: <strong>{reward.pointsCost.toLocaleString()} pts</strong></p>
                    <p className="text-xs text-muted-foreground">Stock: {reward.stock === null ? 'Unlimited' : reward.stock}</p>
                    <Button
                      disabled={!inStock || !canAfford || redeeming === reward.id}
                      className="w-full"
                      onClick={() => handleCatalogRedeem(reward.id)}
                    >
                      {redeeming === reward.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {!inStock ? 'Out of stock' : canAfford ? 'Redeem' : 'Not enough points'}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Section 5: Redemption History ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-green-500" /> Redemption History
        </h2>
        {redemptions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No redemptions yet. Redeem your points above to see history here.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Points</th>
                    <th className="px-4 py-3 text-right font-medium">Value</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {redemptions.map(r => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-xs">{REDEMPTION_LABELS[r.redemptionType as RedemptionType] ?? r.redemptionType}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{r.points.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs">
                        ₹{(r.value / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {r.voucherCode ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Section 6: Recent Points Activity ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" /> Points Activity
        </h2>
        {transactions.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {transactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm">{t.description || t.source}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    <span className={`text-sm font-medium ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.amount > 0 ? '+' : ''}{t.amount} pts
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Earn points through feedback, surveys, and community activity.
            </CardContent>
          </Card>
        )}
      </section>

    </div>
  )
}

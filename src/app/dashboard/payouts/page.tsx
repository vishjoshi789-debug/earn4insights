'use client';

import { POINTS_TO_RUPEES } from '@/lib/points/rate'
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { apiPost, apiPatch } from '@/lib/api-client';
import { getSupportedCurrencies } from '@/lib/currency';
import {
  AddAccountForm, EMPTY_FORM, type PayoutAccountForm,
} from '@/components/payouts/AddAccountForm';
import { Wallet, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * ⚠️ THE ACCOUNT SECTION BELOW IS NOT A NICETY — IT CLOSES A BROKEN CIRCUIT.
 *
 * This page deducts a consumer's points the moment they request a cash-out,
 * but the only form for adding the payout account needed to RECEIVE that money
 * lived on /dashboard/influencer/payouts, behind an influencer-only layout
 * guard. So a pure consumer could spend their points on a payout that could
 * never be paid, and had no way to fix it from anywhere in the product.
 *
 * The API always allowed it (/api/payouts/accounts — "any authenticated role").
 * Only the UI was missing.
 */

type PayoutAccountRow = {
  id: string;
  accountType: string;
  currency: string;
  isPrimary: boolean;
  isVerified: boolean;
  upiId?: string | null;
  paypalEmail?: string | null;
  wiseEmail?: string | null;
  bankName?: string | null;
  accountNumberMasked?: string | null;
};

type PayoutRow = {
  id: string;
  userId: string;
  points: number;
  amount: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  note: string | null;
  userName?: string | null;
};

export default function PayoutsPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  const isBrand = role === 'brand';

  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [payoutPoints, setPayoutPoints] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Payout accounts ────────────────────────────────────────────
  const [accounts, setAccounts] = useState<PayoutAccountRow[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountForm, setAccountForm] = useState<PayoutAccountForm>({ ...EMPTY_FORM });
  const [addingAccount, setAddingAccount] = useState(false);
  const currencies = getSupportedCurrencies();

  const loadAccounts = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const res = await fetch('/api/payouts/accounts');
      const data = await res.json();
      if (res.ok) setAccounts(data.accounts || []);
    } catch {
      // Non-fatal: the cash-out flow still works, the section just shows empty.
    }
  }, [status]);

  const handleAddAccount = async () => {
    if (!accountForm.accountType) return;
    setAddingAccount(true);
    try {
      const res = await apiPost('/api/payouts/accounts', { ...accountForm });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add account');
      toast.success('Payout account added');
      setAccountForm({ ...EMPTY_FORM });
      setShowAddAccount(false);
      await loadAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setAddingAccount(false);
    }
  };

  const loadPayouts = useCallback(async () => {
    if (status !== 'authenticated') {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/payouts');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load payouts');
      }

      setPayouts(data.payouts || []);
      if (data.balance !== undefined) setBalance(data.balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      void loadPayouts();
      void loadAccounts();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [loadPayouts, loadAccounts, status]);

  const handleRequestPayout = async () => {
    const pts = Number(payoutPoints);
    if (!Number.isInteger(pts) || pts < 500) {
      toast.error('Minimum payout is 500 whole points');
      return;
    }

    if (pts > balance) {
      toast.error('You do not have enough points for that payout');
      return;
    }

    setRequesting(true);
    try {
      const res = await apiPost('/api/payouts', { points: pts });

      const data = await res.json();
      if (res.ok) {
        setBalance(data.newBalance);
        setPayoutPoints('');
        toast.success('Payout request submitted');
        await loadPayouts();
      } else {
        throw new Error(data.error || 'Failed to request payout');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const handleProcess = async (payoutId: string, action: 'approved' | 'denied') => {
    setProcessing(payoutId);
    try {
      const res = await apiPatch('/api/payouts', { payoutId, action });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process payout');
      }

      toast.success(action === 'approved' ? 'Payout approved' : 'Payout denied and refunded');
      await loadPayouts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process payout');
    } finally {
      setProcessing(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => void loadPayouts()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const requestedPoints = Number(payoutPoints || 0);
  const requestedAmount = Number.isFinite(requestedPoints) ? (requestedPoints * POINTS_TO_RUPEES).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-2xl font-bold">
          {isBrand ? 'Payout Requests' : 'Cash Out Points'}
        </h1>
        <p className="text-muted-foreground">
          {isBrand
            ? 'Review and manage user payout requests'
            : 'Redeem your earned points for cash (10 points = ₹1)'}
        </p>
      </div>

      {/* PAYOUT ACCOUNTS — where the money will actually go.
          Rendered ABOVE the request form deliberately: requesting a cash-out
          with no account on file produces a request nobody can pay, which is
          precisely the state two real consumers are stuck in. */}
      {!isBrand && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Payout Accounts
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddAccount(v => !v)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {showAddAccount ? 'Cancel' : 'Add Account'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 && !showAddAccount && (
              <div className="flex gap-3 rounded-md border border-amber-800 bg-amber-950/40 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-amber-200">No payout account yet</p>
                  <p className="text-amber-200/80">
                    Add one before cashing out — without it we have nowhere to send your money,
                    and your request cannot be paid.
                  </p>
                </div>
              </div>
            )}

            {accounts.map(acc => (
              <div key={acc.id} className="flex items-center justify-between rounded-md bg-background/40 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {acc.accountType === 'upi' ? `UPI: ${acc.upiId ?? '—'}`
                      : acc.accountType === 'paypal' ? `PayPal: ${acc.paypalEmail ?? '—'}`
                      : acc.accountType === 'wise' ? `Wise: ${acc.wiseEmail ?? '—'}`
                      : [acc.bankName, acc.accountNumberMasked].filter(Boolean).join(' ') || acc.accountType}
                  </p>
                  <p className="text-xs text-muted-foreground">{acc.currency}</p>
                </div>
                <div className="flex items-center gap-2">
                  {acc.isPrimary && (
                    <Badge variant="outline" className="border-emerald-700 text-emerald-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" />Primary
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            {showAddAccount && (
              <AddAccountForm
                form={accountForm}
                setForm={setAccountForm}
                currencies={currencies}
                onSubmit={handleAddAccount}
                submitting={addingAccount}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* REQUEST PAYOUT (consumer only) */}
      {!isBrand && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Request Payout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Current balance: <strong>{balance.toLocaleString()} pts</strong> &middot; Min payout: 500 pts (₹50)
            </p>
            <p className="text-sm text-muted-foreground">
              {/* ⚠️ ₹, not $. This page advertised "100 points = $1" and computed
                  `balance / 100` as USD, while /dashboard/rewards showed ₹0.10 per
                  point for the same balance — the two consumer screens quoted
                  values ~8x apart. Both now read the single PAISE_PER_POINT rate. */}
              Available cash-out value: <strong>₹{(balance * POINTS_TO_RUPEES).toFixed(2)}</strong>
            </p>
            <div className="flex gap-3">
              <Input
                type="number"
                placeholder="Points to cash out (min 500)"
                value={payoutPoints}
                onChange={(e) => setPayoutPoints(e.target.value.replace(/[^\d]/g, ''))}
                min={500}
                max={balance}
                step={100}
                className="max-w-xs"
              />
              <Button
                onClick={handleRequestPayout}
                disabled={requesting || !payoutPoints || !Number.isInteger(requestedPoints) || requestedPoints < 500 || requestedPoints > balance}
              >
                {requesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Request ₹{payoutPoints ? requestedAmount : '0.00'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PAYOUT LIST */}
      <div className="space-y-4">
        {payouts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {isBrand ? 'No payout requests need review right now.' : 'No payout requests yet.'}
            </CardContent>
          </Card>
        ) : (
          payouts.map((request) => (
            <Card key={request.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {isBrand ? (request.userName || 'User') : 'Payout Request'}
                </CardTitle>
                <StatusBadge status={request.status} />
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Requested on: {new Date(request.requestedAt).toLocaleDateString()}
                  {request.processedAt && (
                    <> &middot; Processed: {new Date(request.processedAt).toLocaleDateString()}</>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">₹{request.amount}</p>
                    <p className="text-sm text-muted-foreground">{request.points} points</p>
                  </div>

                  {/* ACTIONS (brand/admin only, pending only) */}
                  {isBrand && request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleProcess(request.id, 'approved')}
                        disabled={processing === request.id}
                      >
                        {processing === request.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleProcess(request.id, 'denied')}
                        disabled={processing === request.id}
                      >
                        Deny
                      </Button>
                    </div>
                  )}
                </div>

                {request.note && (
                  <p className="text-sm text-muted-foreground italic">Note: {request.note}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------- HELPERS ---------------- */

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return <Badge className="bg-green-600">Approved</Badge>;
  }
  if (status === 'denied') {
    return <Badge variant="destructive">Denied</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}

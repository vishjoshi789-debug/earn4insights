'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

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
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [loadPayouts, status]);

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
      const res = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: pts }),
      });

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
      const res = await fetch('/api/payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId, action }),
      });

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
  const requestedAmount = Number.isFinite(requestedPoints) ? (requestedPoints / 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-2xl font-bold">
          {isBrand ? 'Payout Requests' : 'My Payouts'}
        </h1>
        <p className="text-muted-foreground">
          {isBrand
            ? 'Review and manage user payout requests'
            : 'Request payouts for your earned points (100 points = $1)'}
        </p>
      </div>

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
              Current balance: <strong>{balance.toLocaleString()} pts</strong> &middot; Min payout: 500 pts ($5)
            </p>
            <p className="text-sm text-muted-foreground">
              Available cash-out value: <strong>${(balance / 100).toFixed(2)} USD</strong>
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
                Request ${payoutPoints ? requestedAmount : '0.00'}
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
                    <p className="font-medium">${request.amount} USD</p>
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

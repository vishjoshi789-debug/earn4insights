'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign } from 'lucide-react';

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
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isBrand = role === 'brand';

  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [payoutPoints, setPayoutPoints] = useState('');

  const loadPayouts = async () => {
    try {
      const res = await fetch('/api/payouts');
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts);
        if (data.balance !== undefined) setBalance(data.balance);
      }
    } catch (err) {
      console.error('Failed to load payouts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, []);

  const handleRequestPayout = async () => {
    const pts = parseInt(payoutPoints);
    if (!pts || pts < 500) return;
    setRequesting(true);
    try {
      const res = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: pts }),
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.newBalance);
        setPayoutPoints('');
        loadPayouts();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to request payout');
      }
    } catch (err) {
      console.error('Request payout failed:', err);
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
      if (res.ok) {
        loadPayouts();
      }
    } catch (err) {
      console.error('Process payout failed:', err);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            <div className="flex gap-3">
              <Input
                type="number"
                placeholder="Points to cash out (min 500)"
                value={payoutPoints}
                onChange={(e) => setPayoutPoints(e.target.value)}
                min={500}
                max={balance}
                className="max-w-xs"
              />
              <Button
                onClick={handleRequestPayout}
                disabled={requesting || !payoutPoints || parseInt(payoutPoints) < 500 || parseInt(payoutPoints) > balance}
              >
                {requesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Request ${payoutPoints ? (parseInt(payoutPoints) / 100).toFixed(2) : '0.00'}
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
              No payout requests yet.
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

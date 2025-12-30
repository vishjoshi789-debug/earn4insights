'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { mockPayoutRequests } from '@/lib/data';

export default function PayoutsPage() {
  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Payout Requests</h1>
        <p className="text-muted-foreground">
          Review and manage user payout requests
        </p>
      </div>

      {/* PAYOUT LIST */}
      <div className="space-y-4">
        {mockPayoutRequests.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No payout requests yet.
            </CardContent>
          </Card>
        ) : (
          mockPayoutRequests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {request.userName}
                </CardTitle>

                <StatusBadge status={request.status} />
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Requested on:{' '}
                  {new Date(request.requestedAt).toLocaleDateString()}
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">
                      ${request.amount} USD
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {request.points} points
                    </p>
                  </div>

                  {/* ACTIONS */}
                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm">Approve</Button>
                      <Button size="sm" variant="destructive">
                        Deny
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------- HELPERS ---------------- */

function StatusBadge({
  status,
}: {
  status: 'pending' | 'approved' | 'denied';
}) {
  if (status === 'approved') {
    return <Badge className="bg-green-600">Approved</Badge>;
  }

  if (status === 'denied') {
    return <Badge variant="destructive">Denied</Badge>;
  }

  return <Badge variant="secondary">Pending</Badge>;
}

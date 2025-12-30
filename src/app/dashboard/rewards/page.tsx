'use client';

import { mockRewards } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function RewardsPage() {
  const userPoints = 1200; // mock user balance

  return (
    <div className="space-y-8">
      {/* POINTS SUMMARY */}
      <Card>
        <CardHeader>
          <CardTitle>Your Points</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{userPoints} pts</p>
          <p className="text-sm text-muted-foreground">
            Earn points by submitting feedback, surveys, and social engagement.
          </p>
        </CardContent>
      </Card>

      {/* REWARD CATALOG */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Reward Catalog</h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mockRewards.map((reward) => {
            const canRedeem =
              reward.stock === 'unlimited' || reward.stock > 0;
            const hasEnoughPoints = userPoints >= reward.pointsCost;

            return (
              <Card key={reward.id}>
                <CardHeader>
                  <CardTitle>{reward.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    Cost: <strong>{reward.pointsCost} pts</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Stock:{' '}
                    {reward.stock === 'unlimited'
                      ? 'Unlimited'
                      : reward.stock}
                  </p>

                  <Button
                    disabled={!canRedeem || !hasEnoughPoints}
                    className="w-full"
                  >
                    {hasEnoughPoints ? 'Redeem' : 'Not enough points'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

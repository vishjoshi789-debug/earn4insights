'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, Trophy, Star, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

type RewardItem = {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  stock: number | null;
  isActive: boolean;
};

type ChallengeItem = {
  id: string;
  title: string;
  description: string | null;
  pointsReward: number;
  targetCount: number;
  sourceType: string;
  currentCount: number;
  completed: boolean;
};

type PointTransaction = {
  id: string;
  amount: number;
  type: string;
  source: string;
  description: string | null;
  createdAt: string;
};

export default function RewardsPage() {
  const [balance, setBalance] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [catalog, setCatalog] = useState<RewardItem[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [rewardsRes, challengesRes, pointsRes] = await Promise.all([
        fetch('/api/rewards'),
        fetch('/api/challenges'),
        fetch('/api/user/points'),
      ]);

      const [rewardsData, challengesData, pointsData] = await Promise.all([
        rewardsRes.json(),
        challengesRes.json(),
        pointsRes.json(),
      ]);

      if (!rewardsRes.ok) {
        throw new Error(rewardsData.error || 'Failed to load rewards catalog');
      }

      if (!challengesRes.ok) {
        throw new Error(challengesData.error || 'Failed to load challenges');
      }

      if (!pointsRes.ok) {
        throw new Error(pointsData.error || 'Failed to load point balance');
      }

      setCatalog(rewardsData.catalog || []);
      setChallenges(challengesData.challenges || []);
      setBalance(pointsData.balance?.totalPoints ?? rewardsData.balance ?? 0);
      setLifetimePoints(pointsData.balance?.lifetimePoints ?? 0);
      setTransactions((pointsData.transactions || []).slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRedeem = async (rewardId: string) => {
    setRedeeming(rewardId);
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      });

      const data = await res.json();
      if (res.ok) {
        setBalance(data.newBalance);
        toast.success('Reward redeemed successfully');
        await loadData();
      } else {
        throw new Error(data.error || 'Failed to redeem reward');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  const cashValue = (balance / 100).toFixed(2);

  if (loading) {
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
          <Button variant="outline" onClick={() => void loadData()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* POINTS SUMMARY */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Your Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{balance.toLocaleString()} pts</p>
          <p className="text-sm text-muted-foreground mt-1">
            Lifetime earned: {lifetimePoints.toLocaleString()} pts &middot; Earn points by submitting feedback, surveys, and community engagement.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Current cash-out value: ${cashValue} USD
          </p>
        </CardContent>
      </Card>

      {/* CHALLENGES */}
      {challenges.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Challenges
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {challenges.map((c) => {
              const pct = Math.min(100, Math.round((c.currentCount / c.targetCount) * 100));
              return (
                <Card key={c.id} className={c.completed ? 'border-green-200 dark:border-green-800' : ''}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{c.title}</h3>
                      {c.completed ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Done
                        </Badge>
                      ) : (
                        <Badge variant="outline">{c.pointsReward} pts</Badge>
                      )}
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{c.currentCount} / {c.targetCount}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {challenges.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No active challenges are available right now. Earn points through feedback, surveys, and community activity.
          </CardContent>
        </Card>
      )}

      {/* REWARD CATALOG */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Gift className="h-5 w-5 text-indigo-500" />
          Reward Catalog
        </h2>
        {catalog.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No rewards are available yet. Seed the rewards catalog to enable redemption.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map((reward) => {
            const inStock = reward.stock === null || reward.stock > 0;
            const canAfford = balance >= reward.pointsCost;
            const ctaLabel = !inStock ? 'Out of stock' : canAfford ? 'Redeem' : 'Not enough points';

            return (
              <Card key={reward.id}>
                <CardHeader>
                  <CardTitle className="text-base">{reward.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {reward.description && <p className="text-sm text-muted-foreground">{reward.description}</p>}
                  <p className="text-sm">
                    Cost: <strong>{reward.pointsCost.toLocaleString()} pts</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Stock: {reward.stock === null ? 'Unlimited' : reward.stock}
                  </p>
                  <Button
                    disabled={!inStock || !canAfford || redeeming === reward.id}
                    className="w-full"
                    onClick={() => handleRedeem(reward.id)}
                  >
                    {redeeming === reward.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {ctaLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
      </section>

      {/* RECENT TRANSACTIONS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        {transactions.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm">{t.description || t.source}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-sm font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
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
              Your points history will appear here after you earn, spend, or redeem rewards.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

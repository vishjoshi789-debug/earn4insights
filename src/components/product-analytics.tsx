'use client';

import React from 'react';
import type { Feedback, SocialPost } from '@/lib/data';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Props coming from /dashboard/report/[id]/page.tsx
type ProductAnalyticsProps = {
  productId: string;
  feedback: Feedback[];
  socialPosts: SocialPost[];
};

const SENTIMENT_COLORS: Record<Feedback['analysis']['sentiment'], string> = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#eab308',
};

const PLATFORM_LABELS: Record<SocialPost['platform'], string> = {
  twitter: 'Twitter / X',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  meta: 'Facebook',
  google: 'Google Reviews',
  reddit: 'Reddit',
  amazon: 'Amazon Reviews',
  flipkart: 'Flipkart Reviews',
};

export function ProductAnalytics({
  productId,
  feedback,
  socialPosts,
}: ProductAnalyticsProps) {
  // ------- BASIC METRICS -------

  const totalReviews = feedback.length;
  const averageRating =
    totalReviews > 0
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / totalReviews
      : 0;

  const totalSocialPosts = socialPosts.length;
  const totalReach = socialPosts.reduce(
    (sum, p) => sum + p.likes + p.shares + p.comments,
    0,
  );

  // ------- SENTIMENT BREAKDOWN (FEEDBACK + SOCIAL) -------

  const allSentiments = [
    ...feedback.map((f) => f.analysis.sentiment),
    ...socialPosts.map((p) => p.analysis.sentiment),
  ];

  const sentimentCounts = ['positive', 'neutral', 'negative'].map(
    (sentiment) => ({
      sentiment,
      count: allSentiments.filter((s) => s === sentiment).length,
    }),
  );

  // ------- RATING OVER TIME (FEEDBACK) -------

  const ratingOverTime = feedback
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .map((f) => ({
      date: new Date(f.timestamp).toLocaleDateString(),
      rating: f.rating,
    }));

  // ------- SOCIAL REACH BY PLATFORM -------

  const reachByPlatformMap: Record<
    SocialPost['platform'],
    { platform: string; reach: number }
  > = socialPosts.reduce(
    (acc, p) => {
      const reach = p.likes + p.shares + p.comments;
      const label = PLATFORM_LABELS[p.platform] ?? p.platform;
      if (!acc[p.platform]) {
        acc[p.platform] = { platform: label, reach: 0 };
      }
      acc[p.platform].reach += reach;
      return acc;
    },
    {} as Record<SocialPost['platform'], { platform: string; reach: number }>,
  );

  const reachByPlatform = Object.values(reachByPlatformMap);

  // ------- TOP FEEDBACK / POSTS -------

  const topPositiveFeedback = feedback
    .filter((f) => f.analysis.sentiment === 'positive')
    .sort((a, b) => b.analysis.sentimentScore - a.analysis.sentimentScore)
    .slice(0, 3);

  const topSocialPosts = socialPosts
    .slice()
    .sort(
      (a, b) =>
        b.analysis.influenceScore -
        a.analysis.influenceScore,
    )
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* SUMMARY CARDS */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Average Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {averageRating.toFixed(1)}
              <span className="text-sm text-muted-foreground ml-1">/ 5</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Based on {totalReviews} review{totalReviews === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Social Reach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {totalReach.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Across likes, shares & comments ({totalSocialPosts} posts)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Overall Sentiment Mix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sentimentCounts.map((s) => (
              <div key={s.sentiment} className="flex items-center justify-between">
                <span className="text-xs capitalize">{s.sentiment}</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-10 rounded-full"
                    style={{ backgroundColor: SENTIMENT_COLORS[s.sentiment as keyof typeof SENTIMENT_COLORS] }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {s.count}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* RATING OVER TIME + SENTIMENT PIE */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Ratings over time
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {ratingOverTime.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Not enough rating data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratingOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#6366f1"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Sentiment breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {sentimentCounts.every((s) => s.count === 0) ? (
              <p className="text-xs text-muted-foreground">
                No sentiment data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentCounts}
                    dataKey="count"
                    nameKey="sentiment"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) =>
                      `${entry.sentiment} (${entry.count})`
                    }
                  >
                    {sentimentCounts.map((entry, idx) => (
                      <Cell
                        key={entry.sentiment}
                        fill={
                          SENTIMENT_COLORS[
                            entry.sentiment as keyof typeof SENTIMENT_COLORS
                          ]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SOCIAL REACH BY PLATFORM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Social reach by platform
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {reachByPlatform.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No social posts for this product yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reachByPlatform}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="reach" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* TOP FEEDBACK & POSTS */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top customer feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topPositiveFeedback.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No standout positive feedback yet.
              </p>
            ) : (
              topPositiveFeedback.map((f) => (
                <div key={f.id} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{f.userName}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(f.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Rating: {f.rating} / 5
                  </p>
                  <p className="text-sm mt-1">{f.text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top social mentions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topSocialPosts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No key social posts yet.
              </p>
            ) : (
              topSocialPosts.map((p) => (
                <div key={p.id} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {p.userName}{' '}
                      <span className="text-xs text-muted-foreground">
                        @{p.userHandle}
                      </span>
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {PLATFORM_LABELS[p.platform]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reach: {(
                      p.likes +
                      p.shares +
                      p.comments
                    ).toLocaleString()}{' '}
                    · Sentiment: {p.analysis.sentiment}
                  </p>
                  <p className="text-sm mt-1">{p.text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
  LabelList,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// ── New prop types for expanded analytics ─────────────────────────

type SurveyData = {
  npsScore: number | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  submittedAt: string;
};

type RankingData = {
  weekStart: string;
  rank: number;
  score: number;
  category: string;
};

type MediaCounts = { audio: number; video: number; total: number };

type EngagementTotals = {
  views: number;
  likes: number;
  shares: number;
  comments: number;
};

type KOL = {
  author: string;
  handle: string;
  platform: string;
  followers: number;
  influenceScore: number;
  content: string;
};

type CommunityPost = {
  id: string;
  title: string;
  postType: string;
  upvotes: number;
  replyCount: number;
  viewCount: number;
  createdAt: string;
};

type ProductAnalyticsProps = {
  productId: string;
  feedback: Feedback[];
  socialPosts: SocialPost[];
  surveyResponses?: SurveyData[];
  rankings?: RankingData[];
  mediaCounts?: MediaCounts;
  mentionTypes?: Record<string, number>;
  keywordCounts?: Record<string, number>;
  engagement?: EngagementTotals;
  kols?: KOL[];
  communityDiscussions?: CommunityPost[];
};

const RADIAN = Math.PI / 180;

const renderPieLabel = ({
  cx, cy, midAngle, outerRadius, name, value, color = '#374151',
}: {
  cx: number; cy: number; midAngle: number;
  outerRadius: number; name: string; value: number; color?: string;
}) => {
  if (!value) return null;
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill={color}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      {`${name} (${value})`}
    </text>
  );
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#eab308',
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  meta: 'Facebook',
  google: 'Google Reviews',
  reddit: 'Reddit',
  amazon: 'Amazon Reviews',
  flipkart: 'Flipkart Reviews',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  instagram: '#E1306C',
  tiktok: '#010101',
  meta: '#1877F2',
  google: '#EA4335',
  reddit: '#FF4500',
  amazon: '#FF9900',
  flipkart: '#2874F0',
  youtube: '#FF0000',
  linkedin: '#0A66C2',
};

const MENTION_TYPE_COLORS = [
  '#6366f1', '#0ea5e9', '#f97316', '#22c55e', '#ef4444', '#a855f7',
];

export function ProductAnalytics({
  productId,
  feedback,
  socialPosts,
  surveyResponses = [],
  rankings = [],
  mediaCounts,
  mentionTypes = {},
  keywordCounts = {},
  engagement,
  kols = [],
  communityDiscussions = [],
}: ProductAnalyticsProps) {
  // ─── BASIC METRICS ──────────────────────────────────────────────

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

  // ─── SENTIMENT BREAKDOWN ───────────────────────────────────────

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

  // ─── RATING OVER TIME ──────────────────────────────────────────

  const ratingOverTime = feedback
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((f) => ({
      date: new Date(f.timestamp).toLocaleDateString(),
      rating: f.rating,
    }));

  // ─── SOCIAL REACH BY PLATFORM ─────────────────────────────────

  const reachByPlatformMap: Record<string, { platform: string; reach: number; key: string }> =
    socialPosts.reduce(
      (acc, p) => {
        const reach = p.likes + p.shares + p.comments;
        const label = PLATFORM_LABELS[p.platform] ?? p.platform;
        if (!acc[p.platform]) acc[p.platform] = { platform: label, reach: 0, key: p.platform };
        acc[p.platform].reach += reach;
        return acc;
      },
      {} as Record<string, { platform: string; reach: number; key: string }>,
    );

  const reachByPlatform = Object.values(reachByPlatformMap);

  // ─── TOP FEEDBACK / POSTS ─────────────────────────────────────

  const topPositiveFeedback = feedback
    .filter((f) => f.analysis.sentiment === 'positive')
    .sort((a, b) => b.analysis.sentimentScore - a.analysis.sentimentScore)
    .slice(0, 3);

  const topSocialPosts = socialPosts
    .slice()
    .sort((a, b) => b.analysis.influenceScore - a.analysis.influenceScore)
    .slice(0, 3);

  // ─── NPS CALCULATION ──────────────────────────────────────────

  const npsResponses = surveyResponses.filter((s) => s.npsScore !== null);
  const npsScore =
    npsResponses.length >= 1
      ? (() => {
          const promoters = npsResponses.filter((s) => s.npsScore! >= 9).length;
          const detractors = npsResponses.filter((s) => s.npsScore! <= 6).length;
          return Math.round(((promoters - detractors) / npsResponses.length) * 100);
        })()
      : null;

  // ─── MENTION TYPE PIE DATA ────────────────────────────────────

  const mentionTypeData = Object.entries(mentionTypes).map(([type, count]) => ({
    name: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: count,
  }));

  // ─── KEYWORD TOP 15 ──────────────────────────────────────────

  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // ─── NEGATIVE FEEDBACK SPOTLIGHT ──────────────────────────────

  const negativeFeedback = feedback
    .filter((f) => f.analysis.sentiment === 'negative')
    .sort((a, b) => a.analysis.sentimentScore - b.analysis.sentimentScore)
    .slice(0, 5);

  // ─── RANKING CHART DATA ───────────────────────────────────────

  const rankingChartData = rankings
    .slice()
    .reverse()
    .map((r) => ({
      week: new Date(r.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      rank: r.rank,
      score: r.score,
    }));

  // ─── ENGAGEMENT BAR DATA ─────────────────────────────────────

  const engagementBarData = engagement
    ? [
        { metric: 'Views', value: engagement.views },
        { metric: 'Likes', value: engagement.likes },
        { metric: 'Shares', value: engagement.shares },
        { metric: 'Comments', value: engagement.comments },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* ═══ SUMMARY CARDS ═══ */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {averageRating.toFixed(1)}
              <span className="ml-1 text-sm text-muted-foreground">/ 5</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Based on {totalReviews} review{totalReviews === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Social Reach</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalReach.toLocaleString()}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Across likes, shares & comments ({totalSocialPosts} posts)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Overall Sentiment Mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sentimentCounts.map((s) => (
              <div key={s.sentiment} className="flex items-center justify-between">
                <span className="text-xs capitalize">{s.sentiment}</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-10 rounded-full"
                    style={{ backgroundColor: SENTIMENT_COLORS[s.sentiment] }}
                  />
                  <span className="text-xs text-muted-foreground">{s.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ═══ NPS + SURVEY + MEDIA COUNTS ROW ═══ */}
      {(npsScore !== null || surveyResponses.length > 0 || (mediaCounts && mediaCounts.total > 0)) && (
        <div className="grid gap-4 md:grid-cols-3">
          {npsScore !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-3xl font-bold ${
                    npsScore >= 50
                      ? 'text-green-500'
                      : npsScore >= 0
                        ? 'text-yellow-500'
                        : 'text-red-500'
                  }`}
                >
                  {npsScore > 0 ? '+' : ''}
                  {npsScore}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  From {npsResponses.length} survey response{npsResponses.length === 1 ? '' : 's'}
                </p>
              </CardContent>
            </Card>
          )}

          {surveyResponses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Survey Sentiment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {['positive', 'neutral', 'negative'].map((s) => {
                  const count = surveyResponses.filter((sr) => sr.sentiment === s).length;
                  return (
                    <div key={s} className="flex items-center justify-between">
                      <span className="text-xs capitalize">{s}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-10 rounded-full"
                          style={{ backgroundColor: SENTIMENT_COLORS[s] }}
                        />
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {mediaCounts && mediaCounts.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Feedback Media</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{mediaCounts.total}</p>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  {mediaCounts.audio > 0 && <span>{mediaCounts.audio} audio</span>}
                  {mediaCounts.video > 0 && <span>{mediaCounts.video} video</span>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══ RATING OVER TIME + SENTIMENT PIE ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ratings over time</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {ratingOverTime.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not enough rating data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratingOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="rating" stroke="#6366f1" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sentiment breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {sentimentCounts.every((s) => s.count === 0) ? (
              <p className="text-xs text-muted-foreground">No sentiment data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 24, right: 56, bottom: 24, left: 56 }}>
                  <Pie
                    data={sentimentCounts}
                    dataKey="count"
                    nameKey="sentiment"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={(props) =>
                      renderPieLabel({
                        ...props,
                        color: SENTIMENT_COLORS[props.name as string] ?? '#374151',
                      })
                    }
                    labelLine
                  >
                    {sentimentCounts.map((entry) => (
                      <Cell key={entry.sentiment} fill={SENTIMENT_COLORS[entry.sentiment]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ ENGAGEMENT BREAKDOWN + MENTION TYPE ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {engagementBarData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Engagement breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {mentionTypeData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Mention types</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={mentionTypeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={65}
                    innerRadius={30}
                    label={({ cx: pcx, cy: pcy, midAngle, innerRadius: ir, outerRadius: or, value }) => {
                      const r = (ir + or) / 2;
                      const x = pcx + r * Math.cos(-midAngle * RADIAN);
                      const y = pcy + r * Math.sin(-midAngle * RADIAN);
                      return value ? (
                        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                          {value}
                        </text>
                      ) : null;
                    }}
                    labelLine={false}
                  >
                    {mentionTypeData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={MENTION_TYPE_COLORS[idx % MENTION_TYPE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    formatter={(value, entry) => {
                      const item = mentionTypeData.find((d) => d.name === value);
                      return (
                        <span style={{ color: entry.color, fontWeight: 600, fontSize: 12 }}>
                          {value} ({item?.value ?? 0})
                        </span>
                      );
                    }}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ SOCIAL REACH BY PLATFORM ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Social reach by platform</CardTitle>
        </CardHeader>
        <CardContent style={{ height: Math.max(200, reachByPlatform.length * 52) }}>
          {reachByPlatform.length === 0 ? (
            <p className="text-xs text-muted-foreground">No social posts for this product yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={reachByPlatform}
                layout="vertical"
                margin={{ top: 8, right: 48, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  dataKey="platform"
                  type="category"
                  width={110}
                  tick={{ fontSize: 12, fontWeight: 700, fill: 'currentColor' }}
                />
                <Tooltip />
                <Bar dataKey="reach" barSize={24}>
                  {reachByPlatform.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={PLATFORM_COLORS[entry.key] ?? '#8b5cf6'}
                    />
                  ))}
                  <LabelList
                    dataKey="reach"
                    position="right"
                    style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ═══ RANKING HISTORY ═══ */}
      {rankingChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ranking history</CardTitle>
            <p className="text-xs text-muted-foreground">
              {rankingChartData[0].week} – {rankingChartData[rankingChartData.length - 1].week} ({rankingChartData.length} weeks)
            </p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rankingChartData} margin={{ top: 8, right: 16, bottom: 32, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="week"
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  tick={{ fontSize: 10 }}
                  height={48}
                />
                <YAxis reversed domain={[1, 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="rank" stroke="#f97316" strokeWidth={2} name="Rank" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ═══ KEYWORD CLOUD ═══ */}
      {topKeywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top keywords from social posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topKeywords.map(([keyword, count]) => (
                <span
                  key={keyword}
                  className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {keyword}
                  <span className="ml-1 text-muted-foreground">({count})</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ KEY OPINION LEADERS ═══ */}
      {kols.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Key Opinion Leaders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {kols.map((kol, idx) => (
              <div key={idx} className="space-y-1 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {kol.author}{' '}
                    {kol.handle && (
                      <span className="text-xs text-muted-foreground">@{kol.handle}</span>
                    )}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {PLATFORM_LABELS[kol.platform] ?? kol.platform}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {kol.followers.toLocaleString()} followers · Influence:{' '}
                  {(kol.influenceScore * 100).toFixed(0)}%
                </p>
                <p className="text-sm">{kol.content}{kol.content.length >= 120 ? '…' : ''}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ TOP FEEDBACK & SOCIAL POSTS ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top customer feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topPositiveFeedback.length === 0 ? (
              <p className="text-xs text-muted-foreground">No standout positive feedback yet.</p>
            ) : (
              topPositiveFeedback.map((f) => (
                <div key={f.id} className="space-y-1 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{f.userName}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(f.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Rating: {f.rating} / 5</p>
                  <p className="mt-1 text-sm">{f.text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top social mentions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topSocialPosts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No key social posts yet.</p>
            ) : (
              topSocialPosts.map((p) => (
                <div key={p.id} className="space-y-1 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {p.userName}{' '}
                      <span className="text-xs text-muted-foreground">@{p.userHandle}</span>
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {PLATFORM_LABELS[p.platform]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reach: {(p.likes + p.shares + p.comments).toLocaleString()} · Sentiment:{' '}
                    {p.analysis.sentiment}
                  </p>
                  <p className="mt-1 text-sm">{p.text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ NEGATIVE FEEDBACK SPOTLIGHT ═══ */}
      {negativeFeedback.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Negative feedback spotlight</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {negativeFeedback.map((f) => (
              <div key={f.id} className="space-y-1 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{f.userName}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(f.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Rating: {f.rating} / 5</p>
                <p className="mt-1 text-sm">{f.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ COMMUNITY DISCUSSIONS ═══ */}
      {communityDiscussions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Community discussions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {communityDiscussions.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between rounded-md border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{c.title}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="capitalize">{c.postType.replace(/_/g, ' ')}</span>
                    <span>{c.replyCount} replies</span>
                    <span>{c.viewCount} views</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-medium text-primary">+{c.upvotes}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

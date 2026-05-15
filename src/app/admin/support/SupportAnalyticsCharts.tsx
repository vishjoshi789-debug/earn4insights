'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type Analytics = {
  windowDays: number
  openByStatus: Record<string, number>
  avgFirstResponseHours: number | null
  avgResolutionHours: number | null
  satisfactionAvg: number | null
  aiResolutionRate: { started: number; resolvedByAi: number; rate: number }
  faqViewsLastN: number
  escalationsLastN: number
  ticketsOverTime: { day: string; count: number }[]
  byCategory: { key: string; count: number }[]
  byPriority: { key: string; count: number }[]
  byRole: { key: string; count: number }[]
  resolutionBuckets: { bucket: string; count: number }[]
  satisfactionDistribution: { rating: number; count: number }[]
  recentEscalations: Array<{
    conversationId: string
    ticketId: string
    ticketNumber: string
    subject: string
    userId: string
    userRole: string
    totalMessages: number
    escalatedAt: string
  }>
}

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--muted-foreground))']

export function SupportAnalyticsCharts({ data }: { data: Analytics }) {
  const aiVsHuman = [
    { name: 'Resolved by AI', value: data.aiResolutionRate.resolvedByAi },
    {
      name: 'Resolved by team',
      value: Math.max(0, data.aiResolutionRate.started - data.aiResolutionRate.resolvedByAi),
    },
  ]

  const satisfactionFull = [1, 2, 3, 4, 5].map((r) => ({
    rating: `${r}★`,
    count: data.satisfactionDistribution.find((d) => d.rating === r)?.count ?? 0,
  }))

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Tickets over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tickets over time (last {data.windowDays}d)</CardTitle>
        </CardHeader>
        <CardContent className="h-[220px]">
          {data.ticketsOverTime.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.ticketsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* By category */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tickets by category</CardTitle>
        </CardHeader>
        <CardContent className="h-[220px]">
          {data.byCategory.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="key"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={110}
                  tickFormatter={(s: string) => s.replace(/_/g, ' ')}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Resolution time distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resolution time distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-[220px]">
          {data.resolutionBuckets.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.resolutionBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* AI vs human pie */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">AI vs team resolution</CardTitle>
        </CardHeader>
        <CardContent className="h-[220px]">
          {data.aiResolutionRate.started === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={aiVsHuman}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {aiVsHuman.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Satisfaction distribution — full width */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Satisfaction distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-[200px]">
          {satisfactionFull.every((r) => r.count === 0) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={satisfactionFull}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      No data in this window yet.
    </div>
  )
}

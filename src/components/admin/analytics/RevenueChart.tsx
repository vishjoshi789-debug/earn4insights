'use client'

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import type { RevenueBlock } from '@/lib/types/platformAnalytics'

interface Props {
  data: RevenueBlock
}

function formatXTick(value: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function compactPaise(v: number | string): string {
  // Compact tick label: ₹1.2k / ₹3.4M from paise
  const n = typeof v === 'number' ? v : Number(v)
  const rupees = n / 100
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(1)}Cr`
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(1)}L`
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`
  return `₹${rupees.toFixed(0)}`
}

export function RevenueChart({ data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[260px]">
          {data.series.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={formatXTick} tick={{ fontSize: 11 }} minTickGap={32} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={compactPaise} width={56} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => formatXTick(String(v))}
                  formatter={(value: number | string, name) => [formatCurrency(Number(value)), name as string]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="Gross" dataKey="gross" fill="#6366f1" radius={[2, 2, 0, 0]} />
                <Line
                  name="Net (E4I keeps)"
                  type="monotone"
                  dataKey="net"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  name="Platform fees"
                  type="monotone"
                  dataKey="fees"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-border text-xs">
          <Stat label="Gross" value={formatCurrency(data.totalGross)} />
          <Stat label="Fees" value={formatCurrency(data.totalFees)} />
          <Stat label="Net" value={formatCurrency(data.totalNet)} tone="positive" />
          <Stat
            label="Payments"
            value={`${data.payments.totalCount} (${data.payments.successRatePct.toFixed(1)}% ok)`}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${tone === 'positive' ? 'text-emerald-500' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="h-full grid place-items-center text-xs text-muted-foreground">
      No revenue in the selected window.
    </div>
  )
}

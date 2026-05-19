'use client'

import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { CostCategory } from '@/lib/types/platformAnalytics'

interface Props {
  breakdown: Array<{ category: CostCategory; amount: number }> // paise
  totalCosts: number                                            // paise
  month: string                                                 // 'YYYY-MM-DD' (first of month)
}

const CATEGORY_LABELS: Record<CostCategory, string> = {
  hosting: 'Hosting',
  database: 'Database',
  ai_api: 'AI API',
  email_service: 'Email',
  sms_whatsapp: 'SMS / WhatsApp',
  cdn_storage: 'CDN / Storage',
  payment_gateway: 'Payment gateway',
  marketing: 'Marketing',
  salaries: 'Salaries',
  legal: 'Legal',
  office: 'Office',
  tools_subscriptions: 'Tools / SaaS',
  other: 'Other',
}

// Deterministic color per category — distinguishable in dark mode.
const CATEGORY_COLORS: Record<CostCategory, string> = {
  hosting:              '#6366f1', // indigo
  database:             '#0ea5e9', // sky
  ai_api:               '#a855f7', // purple
  email_service:        '#10b981', // emerald
  sms_whatsapp:         '#22c55e', // green
  cdn_storage:          '#14b8a6', // teal
  payment_gateway:      '#f59e0b', // amber
  marketing:            '#ec4899', // pink
  salaries:             '#ef4444', // red
  legal:                '#8b5cf6', // violet
  office:               '#64748b', // slate
  tools_subscriptions:  '#06b6d4', // cyan
  other:                '#71717a', // zinc
}

function compactPaise(v: number): string {
  const rupees = v / 100
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(1)}Cr`
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(1)}L`
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`
  return `₹${rupees.toFixed(0)}`
}

function formatMonthLong(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function CostBreakdownDonut({ breakdown, totalCosts, month }: Props) {
  const [active, setActive] = useState<CostCategory | null>(null)

  const filtered = breakdown.filter((b) => b.amount > 0)
  const sorted = [...filtered].sort((a, b) => b.amount - a.amount)
  const data = sorted.map((b) => ({
    name: CATEGORY_LABELS[b.category],
    value: b.amount,
    category: b.category,
  }))

  const activeDatum = active ? sorted.find((b) => b.category === active) : null
  const activePct = activeDatum && totalCosts > 0 ? (activeDatum.amount / totalCosts) * 100 : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cost breakdown</CardTitle>
        <p className="text-[11px] text-muted-foreground pt-1">
          {formatMonthLong(month)} &middot; click a slice for the % share.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3 items-center">
          {/* Donut */}
          <div className="relative h-[220px]">
            {data.length === 0 ? (
              <div className="h-full grid place-items-center text-xs text-muted-foreground">
                No costs entered for {formatMonthLong(month)} yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      formatter={(value: number | string, name) => [formatCurrency(Number(value)), name as string]}
                    />
                    <Pie
                      data={data}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={84}
                      paddingAngle={2}
                      onClick={(d: any) => setActive((prev) => (prev === d.category ? null : d.category))}
                    >
                      {data.map((d) => (
                        <Cell
                          key={d.category}
                          fill={CATEGORY_COLORS[d.category]}
                          opacity={active && active !== d.category ? 0.4 : 1}
                          stroke="hsl(var(--background))"
                          strokeWidth={1.5}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center total */}
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  {activeDatum ? (
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {CATEGORY_LABELS[activeDatum.category]}
                      </p>
                      <p className="text-lg font-semibold tabular-nums">{compactPaise(activeDatum.amount)}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{activePct.toFixed(1)}%</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="text-lg font-semibold tabular-nums">{compactPaise(totalCosts)}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Legend */}
          <ul className="space-y-1 text-xs max-h-[220px] overflow-y-auto pr-1">
            {sorted.map((b) => {
              const pct = totalCosts > 0 ? (b.amount / totalCosts) * 100 : 0
              const isActive = active === b.category
              return (
                <li
                  key={b.category}
                  onClick={() => setActive((prev) => (prev === b.category ? null : b.category))}
                  className={cn(
                    'flex items-center justify-between gap-2 px-2 py-1 rounded cursor-pointer',
                    isActive ? 'bg-muted/50' : 'hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: CATEGORY_COLORS[b.category] }}
                      aria-hidden
                    />
                    <span className="truncate">{CATEGORY_LABELS[b.category]}</span>
                  </div>
                  <span className="text-right tabular-nums shrink-0">
                    <span className="text-foreground font-medium">{compactPaise(b.amount)}</span>
                    <span className="text-muted-foreground"> ({pct.toFixed(0)}%)</span>
                  </span>
                </li>
              )
            })}
            {sorted.length === 0 && (
              <li className="text-muted-foreground italic px-2 py-2 text-center">No entries</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

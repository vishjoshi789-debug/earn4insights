'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lightbulb, AlertTriangle, AlertOctagon, Sparkles, Check } from 'lucide-react'

type Severity = 'critical' | 'warning' | 'info' | 'opportunity'

export type Insight = {
  id: string
  insightType: string
  title: string
  summary: string
  severity: Severity
  isActionable: boolean
  actionSuggestion: string | null
  isRead: boolean
  createdAt: string
}

const SEVERITY: Record<Severity, { icon: typeof Lightbulb; className: string; label: string }> = {
  critical: { icon: AlertOctagon, className: 'bg-red-100 text-red-800', label: 'Critical' },
  warning: { icon: AlertTriangle, className: 'bg-amber-100 text-amber-800', label: 'Warning' },
  info: { icon: Lightbulb, className: 'bg-slate-100 text-slate-700', label: 'Info' },
  opportunity: { icon: Sparkles, className: 'bg-emerald-100 text-emerald-800', label: 'Opportunity' },
}

export function InsightsFeed({ initial }: { initial: Insight[] }) {
  const [insights, setInsights] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function markRead(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/brand/competitive-intelligence/insights/${id}`, { method: 'PATCH' })
      if (res.ok) {
        setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, isRead: true } : i)))
      }
    } finally {
      setBusyId(null)
    }
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-slate-500">
          No insights yet. Add competitors and wait for the next daily run.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI insights</CardTitle>
        <CardDescription>
          Max 3 / day per brand. Competitor-level data only — no raw feedback or individual consumers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((i) => {
          const Icon = SEVERITY[i.severity].icon
          return (
            <div
              key={i.id}
              className={`rounded-lg border p-3 ${i.isRead ? 'bg-slate-50' : 'bg-white'} flex gap-3`}
            >
              <div className="pt-0.5">
                <Icon className="h-5 w-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-slate-900 leading-snug">{i.title}</div>
                  <Badge className={SEVERITY[i.severity].className} variant="secondary">
                    {SEVERITY[i.severity].label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{i.summary}</p>
                {i.isActionable && i.actionSuggestion && (
                  <div className="mt-2 rounded bg-blue-50 px-2 py-1.5 text-xs text-blue-900">
                    <strong>Suggested action:</strong> {i.actionSuggestion}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })} · {i.insightType.replaceAll('_', ' ')}
                  </span>
                  {!i.isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === i.id}
                      onClick={() => markRead(i.id)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Mark read
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

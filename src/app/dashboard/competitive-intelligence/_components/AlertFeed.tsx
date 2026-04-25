'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BellRing, Check } from 'lucide-react'

type Severity = 'critical' | 'warning' | 'info'

export type Alert = {
  id: string
  alertType: string
  title: string
  description: string
  severity: Severity
  isRead: boolean
  createdAt: string
}

const SEV_CLASS: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-slate-100 text-slate-700',
}

export function AlertFeed({ initial }: { initial: Alert[] }) {
  const [alerts, setAlerts] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function markRead(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/brand/competitive-intelligence/alerts/${id}`, { method: 'PATCH' })
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)))
      }
    } finally {
      setBusyId(null)
    }
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-slate-500">
          No alerts yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Competitor alerts</CardTitle>
        <CardDescription>Real-time events on tracked competitors.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`flex items-start gap-3 rounded border p-2.5 ${a.isRead ? 'bg-slate-50' : 'bg-white'}`}
          >
            <BellRing className="mt-0.5 h-4 w-4 text-slate-500" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-slate-900 leading-snug">{a.title}</div>
                <Badge className={SEV_CLASS[a.severity]} variant="secondary">
                  {a.severity}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{a.description}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })} · {a.alertType.replaceAll('_', ' ')}
                </span>
                {!a.isRead && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={busyId === a.id}
                    onClick={() => markRead(a.id)}
                  >
                    <Check className="mr-1 h-3 w-3" /> Read
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

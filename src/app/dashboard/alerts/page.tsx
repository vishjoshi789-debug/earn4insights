'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bell, CheckCheck, AlertCircle, MessageSquare, BarChart3,
  TrendingUp, Eye, Loader2, Inbox
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Alert = {
  id: string
  brandId: string
  ruleId: string | null
  alertType: string
  productId: string | null
  consumerId: string | null
  title: string
  body: string
  payload: Record<string, any> | null
  channel: string
  status: string
  createdAt: string
  sentAt: string | null
  readAt: string | null
}

const alertTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  new_feedback: { icon: MessageSquare, color: 'bg-blue-100 text-blue-700', label: 'New Feedback' },
  negative_feedback: { icon: AlertCircle, color: 'bg-red-100 text-red-700', label: 'Negative Feedback' },
  survey_complete: { icon: BarChart3, color: 'bg-green-100 text-green-700', label: 'Survey Complete' },
  high_intent_consumer: { icon: TrendingUp, color: 'bg-purple-100 text-purple-700', label: 'High Intent' },
  watchlist_milestone: { icon: Eye, color: 'bg-amber-100 text-amber-700', label: 'Watchlist' },
  frustration_spike: { icon: AlertCircle, color: 'bg-red-100 text-red-700', label: 'Frustration Spike' },
}

export default function AlertsPage() {
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/brand/alerts?limit=50')
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.alerts || [])
        setUnread(data.unread || 0)
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  async function markAsRead(alertId: string) {
    const res = await fetch(`/api/brand/alerts?id=${encodeURIComponent(alertId)}`, { method: 'PATCH' })
    if (res.ok) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: 'read', readAt: new Date().toISOString() } : a))
      )
      setUnread((prev) => Math.max(0, prev - 1))
    }
  }

  async function markAllRead() {
    setMarkingAll(true)
    const res = await fetch('/api/brand/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    })
    if (res.ok) {
      setAlerts((prev) => prev.map((a) => ({ ...a, status: 'read', readAt: a.readAt || new Date().toISOString() })))
      setUnread(0)
    }
    setMarkingAll(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">
            {unread > 0 ? `${unread} unread alert${unread !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll}>
            {markingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
            Mark all read
          </Button>
        )}
      </div>

      {/* Alert List */}
      {alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No alerts yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You&apos;ll see alerts here when consumers interact with your products.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const config = alertTypeConfig[alert.alertType] || {
              icon: Bell,
              color: 'bg-gray-100 text-gray-700',
              label: alert.alertType,
            }
            const Icon = config.icon
            const isUnread = alert.status !== 'read'

            return (
              <Card
                key={alert.id}
                className={`transition-colors ${isUnread ? 'border-l-4 border-l-primary bg-primary/[0.02]' : 'opacity-75'}`}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div className={`rounded-full p-2 shrink-0 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium text-sm ${isUnread ? '' : 'text-muted-foreground'}`}>
                        {alert.title}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{alert.body}</p>
                    <span className="text-xs text-muted-foreground mt-1 block">
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {isUnread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => markAsRead(alert.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

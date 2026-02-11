'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity, Users, Eye, MousePointerClick, Globe, Monitor, Smartphone,
  Tablet, Clock, RefreshCw, BarChart3, MapPin, Loader2, ShieldCheck
} from 'lucide-react'

type ViewType = 'overview' | 'live' | 'visitors' | 'pages' | 'devices' | 'geo' | 'events' | 'timeline'

export default function AdminAnalyticsPage() {
  const [adminKey, setAdminKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [view, setView] = useState<ViewType>('overview')
  const [hours, setHours] = useState(24)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchData = useCallback(async (v?: ViewType) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics?view=${v || view}&hours=${hours}&key=${adminKey}`)
      const json = await res.json()
      if (res.ok) {
        setData(json)
        setLastUpdated(new Date().toLocaleTimeString())
      } else {
        if (res.status === 401) setAuthenticated(false)
      }
    } catch { }
    setLoading(false)
  }, [view, hours, adminKey])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!authenticated || !autoRefresh) return
    fetchData()
    const interval = setInterval(() => fetchData(), 10000)
    return () => clearInterval(interval)
  }, [authenticated, autoRefresh, view, hours, fetchData])

  // Auth screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              Admin Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault()
              setAuthenticated(true)
            }} className="space-y-4">
              <input
                type="password"
                placeholder="Enter admin key..."
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background text-foreground"
              />
              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                Access Dashboard
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const tabs: { key: ViewType; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'live', label: 'Live Feed', icon: <Activity className="w-4 h-4" /> },
    { key: 'visitors', label: 'Visitors', icon: <Users className="w-4 h-4" /> },
    { key: 'pages', label: 'Pages', icon: <Eye className="w-4 h-4" /> },
    { key: 'devices', label: 'Devices', icon: <Monitor className="w-4 h-4" /> },
    { key: 'geo', label: 'Geography', icon: <Globe className="w-4 h-4" /> },
    { key: 'events', label: 'Events', icon: <MousePointerClick className="w-4 h-4" /> },
    { key: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Activity className="w-7 h-7 text-purple-400" />
            Deep Analytics Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time user activity tracking • Every click, every visit
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range */}
          {[1, 6, 24, 72, 168, 720].map((h) => (
            <Button
              key={h}
              size="sm"
              variant={hours === h ? 'default' : 'outline'}
              onClick={() => { setHours(h); setData(null) }}
              className={hours === h ? 'bg-purple-600' : ''}
            >
              {h < 24 ? `${h}h` : `${h / 24}d`}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'text-green-400' : 'text-muted-foreground'}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </Button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">Updated: {lastUpdated}</span>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={view === tab.key ? 'default' : 'ghost'}
            className={view === tab.key ? 'bg-purple-600' : ''}
            onClick={() => { setView(tab.key); setData(null) }}
          >
            {tab.icon}
            <span className="ml-1">{tab.label}</span>
          </Button>
        ))}
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      ) : (
        <>
          {view === 'overview' && data?.data && <OverviewView data={data.data} />}
          {view === 'live' && data?.events && <LiveFeedView events={data.events} />}
          {view === 'visitors' && data?.visitors && <VisitorsView visitors={data.visitors} />}
          {view === 'pages' && data?.pages && <PagesView pages={data.pages} />}
          {view === 'devices' && <DevicesView data={data} />}
          {view === 'geo' && <GeoView data={data} />}
          {view === 'events' && data?.events && <EventsView events={data.events} />}
          {view === 'timeline' && data?.timeline && <TimelineView timeline={data.timeline} />}
        </>
      )}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────

function OverviewView({ data }: { data: any }) {
  const stats = [
    { label: 'Total Events', value: data.totalEvents, icon: <Activity className="w-5 h-5 text-blue-400" /> },
    { label: 'Unique Visitors', value: data.uniqueVisitors, icon: <Users className="w-5 h-5 text-green-400" /> },
    { label: 'Sessions', value: data.uniqueSessions, icon: <Monitor className="w-5 h-5 text-yellow-400" /> },
    { label: 'Page Views', value: data.pageViews, icon: <Eye className="w-5 h-5 text-purple-400" /> },
    { label: 'Clicks', value: data.clicks, icon: <MousePointerClick className="w-5 h-5 text-red-400" /> },
    { label: 'Form Submits', value: data.formSubmits, icon: <BarChart3 className="w-5 h-5 text-orange-400" /> },
    { label: 'Logged-in Users', value: data.loggedInUsers, icon: <ShieldCheck className="w-5 h-5 text-cyan-400" /> },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="pt-6 text-center">
            <div className="flex justify-center mb-2">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Live Feed ─────────────────────────────────────────────────────

function LiveFeedView({ events }: { events: any[] }) {
  const typeColors: Record<string, string> = {
    page_view: 'bg-blue-900/30 text-blue-400 border-blue-700',
    click: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
    page_leave: 'bg-gray-800/30 text-gray-400 border-gray-600',
    form_submit: 'bg-green-900/30 text-green-400 border-green-700',
  }

  const deviceIcons: Record<string, React.ReactNode> = {
    desktop: <Monitor className="w-3 h-3" />,
    mobile: <Smartphone className="w-3 h-3" />,
    tablet: <Tablet className="w-3 h-3" />,
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Latest 100 events (auto-refreshing)</p>
      <div className="space-y-1 max-h-[70vh] overflow-y-auto">
        {events.map((evt) => (
          <div key={evt.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm">
            <Badge variant="outline" className={`text-xs ${typeColors[evt.eventType] || ''}`}>
              {evt.eventName}
            </Badge>
            <span className="text-muted-foreground truncate max-w-[200px]">{evt.pagePath}</span>
            {evt.elementText && (
              <span className="text-xs text-purple-400 truncate max-w-[150px]">
                &quot;{evt.elementText}&quot;
              </span>
            )}
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
              {deviceIcons[evt.deviceType] || null}
              {evt.country && <span>🌍{evt.country}</span>}
              {evt.city && <span>{evt.city}</span>}
              <span>{new Date(evt.createdAt).toLocaleTimeString()}</span>
            </span>
          </div>
        ))}
        {events.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No events yet. Waiting for visitors...</p>
        )}
      </div>
    </div>
  )
}

// ── Visitors ──────────────────────────────────────────────────────

function VisitorsView({ visitors }: { visitors: any[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{visitors.length} unique visitors</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="pb-2 pr-4">Visitor</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">Sessions</th>
              <th className="pb-2 pr-4">Events</th>
              <th className="pb-2 pr-4">Device</th>
              <th className="pb-2 pr-4">Location</th>
              <th className="pb-2">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {visitors.map((v, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono text-xs">
                  {v.userId ? <span className="text-green-400">{v.userId.slice(0, 12)}...</span> : <span className="text-muted-foreground">{v.visitorId?.slice(0, 8)}... (anon)</span>}
                </td>
                <td className="py-2 pr-4">{v.userRole || '—'}</td>
                <td className="py-2 pr-4">{v.sessionCount}</td>
                <td className="py-2 pr-4">{v.eventCount}</td>
                <td className="py-2 pr-4 text-xs">{v.browser} / {v.os} / {v.deviceType}</td>
                <td className="py-2 pr-4">{[v.city, v.country].filter(Boolean).join(', ') || '—'}</td>
                <td className="py-2 text-xs text-muted-foreground">{v.lastSeen ? new Date(v.lastSeen).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Pages ─────────────────────────────────────────────────────────

function PagesView({ pages }: { pages: any[] }) {
  const maxViews = Math.max(...pages.map((p: any) => p.views), 1)
  return (
    <div className="space-y-2">
      {pages.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card">
          <span className="text-sm font-mono truncate flex-1">{p.pagePath || '/'}</span>
          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(p.views / maxViews) * 100}%` }} />
          </div>
          <span className="text-sm font-bold w-12 text-right">{p.views}</span>
          <span className="text-xs text-muted-foreground w-20">
            {p.uniqueVisitors} visitor{p.uniqueVisitors !== 1 ? 's' : ''}
          </span>
          {p.avgScrollDepth != null && (
            <span className="text-xs text-muted-foreground w-16">↕{Math.round(p.avgScrollDepth)}%</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Devices ───────────────────────────────────────────────────────

function DevicesView({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Device Type</CardTitle></CardHeader>
        <CardContent>
          {data.deviceTypes?.map((d: any, i: number) => (
            <div key={i} className="flex justify-between py-1">
              <span className="flex items-center gap-1">
                {d.deviceType === 'desktop' ? <Monitor className="w-4 h-4" /> : d.deviceType === 'mobile' ? <Smartphone className="w-4 h-4" /> : <Tablet className="w-4 h-4" />}
                {d.deviceType || 'Unknown'}
              </span>
              <span className="font-bold">{d.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Browsers</CardTitle></CardHeader>
        <CardContent>
          {data.browsers?.map((b: any, i: number) => (
            <div key={i} className="flex justify-between py-1 text-sm">
              <span>{b.browser || 'Unknown'}</span>
              <span className="font-bold">{b.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Operating Systems</CardTitle></CardHeader>
        <CardContent>
          {data.operatingSystems?.map((o: any, i: number) => (
            <div key={i} className="flex justify-between py-1 text-sm">
              <span>{o.os || 'Unknown'}</span>
              <span className="font-bold">{o.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Geography ─────────────────────────────────────────────────────

function GeoView({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-1"><Globe className="w-4 h-4" /> Countries</CardTitle></CardHeader>
        <CardContent>
          {data.countries?.map((c: any, i: number) => (
            <div key={i} className="flex justify-between py-1 text-sm">
              <span>{c.country || 'Unknown'}</span>
              <span><span className="font-bold">{c.count}</span> <span className="text-xs text-muted-foreground">({c.uniqueVisitors} visitor{c.uniqueVisitors !== 1 ? 's' : ''})</span></span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-1"><MapPin className="w-4 h-4" /> Cities</CardTitle></CardHeader>
        <CardContent>
          {data.cities?.map((c: any, i: number) => (
            <div key={i} className="flex justify-between py-1 text-sm">
              <span>{[c.city, c.country].filter(Boolean).join(', ') || 'Unknown'}</span>
              <span className="font-bold">{c.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Events ────────────────────────────────────────────────────────

function EventsView({ events }: { events: any[] }) {
  return (
    <div className="space-y-2">
      {events.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card text-sm">
          <Badge variant="outline" className="text-xs">{e.eventType}</Badge>
          <span className="font-mono">{e.eventName}</span>
          <span className="ml-auto font-bold">{e.count}</span>
        </div>
      ))}
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────

function TimelineView({ timeline }: { timeline: any[] }) {
  const maxPV = Math.max(...timeline.map((t: any) => t.pageViews || 0), 1)
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground mb-4">Page views over time</p>
      {timeline.map((t: any, i: number) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="w-36 text-xs text-muted-foreground whitespace-nowrap">
            {new Date(t.bucket).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
            <div className="h-full bg-purple-500 rounded" style={{ width: `${(t.pageViews / maxPV) * 100}%` }} />
          </div>
          <span className="w-10 text-right font-bold">{t.pageViews}</span>
          <span className="w-10 text-right text-xs text-muted-foreground">{t.uniqueVisitors}👤</span>
        </div>
      ))}
    </div>
  )
}

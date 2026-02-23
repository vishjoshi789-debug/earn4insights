'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity, Users, Eye, MousePointerClick, Globe, Monitor, Smartphone,
  Tablet, Clock, RefreshCw, BarChart3, MapPin, Loader2, ShieldCheck,
  Search, Filter, ChevronDown, History
} from 'lucide-react'

type ViewType = 'overview' | 'live' | 'visitors' | 'pages' | 'devices' | 'geo' | 'events' | 'timeline'

export default function AdminAnalyticsPage() {
  const [inputKey, setInputKey] = useState('')
  const [adminKey, setAdminKey] = useState<string | null>(null)
  const [authError, setAuthError] = useState('')
  const [view, setView] = useState<ViewType>('overview')
  const [hours, setHours] = useState(24)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // Try to restore key from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('e4i_admin_key')
    if (saved) setAdminKey(saved)
  }, [])

  const fetchData = useCallback(async (key: string, v?: ViewType) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics?view=${v || view}&hours=${hours}&key=${encodeURIComponent(key)}`)
      const json = await res.json()
      if (res.ok) {
        setData(json)
        setLastUpdated(new Date().toLocaleTimeString())
      }
    } catch { }
    setLoading(false)
  }, [view, hours])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!adminKey || !autoRefresh) return
    fetchData(adminKey)
    const interval = setInterval(() => fetchData(adminKey), 10000)
    return () => clearInterval(interval)
  }, [adminKey, autoRefresh, view, hours, fetchData])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    // Verify the key actually works before granting access
    try {
      const res = await fetch(`/api/admin/analytics?view=overview&hours=24&key=${encodeURIComponent(inputKey)}`)
      if (res.ok) {
        setAdminKey(inputKey)
        sessionStorage.setItem('e4i_admin_key', inputKey)
        const json = await res.json()
        setData(json)
        setLastUpdated(new Date().toLocaleTimeString())
      } else {
        setAuthError('Invalid admin key. Please try again.')
      }
    } catch {
      setAuthError('Connection error. Please try again.')
    }
  }

  // Auth screen
  if (!adminKey) {
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
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                placeholder="Enter admin key..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background text-foreground"
              />
              {authError && (
                <p className="text-sm text-red-400">{authError}</p>
              )}
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
          {view === 'visitors' && data?.visitors && (
            <VisitorsView visitors={data.visitors} adminKey={adminKey} hours={hours} />
          )}
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

function VisitorsView({
  visitors,
  adminKey,
  hours,
}: {
  visitors: any[]
  adminKey: string
  hours: number
}) {
  const [openVisitorId, setOpenVisitorId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [fullHistoryLoading, setFullHistoryLoading] = useState(false)
  const [fullHistoryEvents, setFullHistoryEvents] = useState<any[] | null>(null)

  // Filter / search state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const loadVisitorDetail = useCallback(async (visitorId: string) => {
    setDetailLoading(true)
    setDetail(null)
    setFullHistoryEvents(null)
    try {
      const res = await fetch(
        `/api/admin/analytics?view=visitor&hours=${hours}&key=${encodeURIComponent(adminKey)}&visitorId=${encodeURIComponent(visitorId)}`
      )
      const json = await res.json()
      if (res.ok) setDetail(json)
    } catch {
      // ignore
    } finally {
      setDetailLoading(false)
    }
  }, [adminKey, hours])

  const loadFullHistory = useCallback(async (visitorId: string) => {
    setFullHistoryLoading(true)
    try {
      const res = await fetch(
        `/api/admin/analytics?view=visitor&hours=8760&key=${encodeURIComponent(adminKey)}&visitorId=${encodeURIComponent(visitorId)}&limit=500`
      )
      const json = await res.json()
      if (res.ok) setFullHistoryEvents(json.events || [])
    } catch {
      // ignore
    } finally {
      setFullHistoryLoading(false)
    }
  }, [adminKey])

  const getDemographic = (demographics: any, key: string) => {
    if (!demographics || typeof demographics !== 'object') return null
    return demographics[key] || null
  }

  const getInterestCategories = (interests: any): string[] => {
    if (!interests || typeof interests !== 'object') return []
    const cats = interests.productCategories
    return Array.isArray(cats) ? cats : []
  }

  // Predefined filter options (always available)
  const genderOptions = ['male', 'female', 'non-binary', 'prefer-not-to-say']
  const roleOptions = ['user', 'brand', 'admin']

  // Dynamic country list from actual visitor data
  const uniqueCountries = Array.from(new Set(visitors.map(v => v.country).filter(Boolean))).sort()

  // Merge predefined + any extra values from data
  const dataGenders = visitors.map(v => getDemographic(v.demographics, 'gender')).filter(Boolean)
  const allGenders = Array.from(new Set([...genderOptions, ...dataGenders]))
  const dataRoles = visitors.map(v => v.userRole || v.userAccountRole).filter(Boolean)
  const allRoles = Array.from(new Set([...roleOptions, ...dataRoles]))

  // Apply filters
  const filteredVisitors = visitors.filter(v => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const email = (v.email || '').toLowerCase()
      const name = (v.userName || '').toLowerCase()
      const vid = (v.visitorId || '').toLowerCase()
      const uid = (v.userId || '').toLowerCase()
      const profession = (getDemographic(v.demographics, 'profession') || '').toLowerCase()
      if (!email.includes(q) && !name.includes(q) && !vid.includes(q) && !uid.includes(q) && !profession.includes(q)) return false
    }
    if (filterCountry && v.country !== filterCountry) return false
    if (filterRole) {
      const vRole = (v.userRole || v.userAccountRole || '').toLowerCase()
      if (vRole !== filterRole.toLowerCase()) return false
    }
    if (filterGender) {
      const vGender = (getDemographic(v.demographics, 'gender') || '').toLowerCase()
      if (vGender !== filterGender.toLowerCase()) return false
    }
    return true
  })

  const activeFilterCount = [filterCountry, filterRole, filterGender].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by email, name, or visitor ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-md border bg-background text-foreground text-sm"
            />
          </div>
          <Button
            size="sm"
            variant={showFilters ? 'default' : 'outline'}
            className={showFilters ? 'bg-purple-600' : ''}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{activeFilterCount}</Badge>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-card">
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="px-2 py-1.5 rounded-md border bg-background text-foreground text-sm"
            >
              <option value="">All Countries</option>
              {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-2 py-1.5 rounded-md border bg-background text-foreground text-sm"
            >
              <option value="">All Roles</option>
              {allRoles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="px-2 py-1.5 rounded-md border bg-background text-foreground text-sm"
            >
              <option value="">All Genders</option>
              {allGenders.map(g => (
                <option key={g} value={g}>
                  {g === 'prefer-not-to-say' ? 'Prefer not to say' : g === 'non-binary' ? 'Non-binary' : g.charAt(0).toUpperCase() + g.slice(1)}
                </option>
              ))}
            </select>
            {activeFilterCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={() => { setFilterCountry(''); setFilterRole(''); setFilterGender('') }}
              >
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {filteredVisitors.length === visitors.length
          ? `${visitors.length} unique visitors`
          : `${filteredVisitors.length} of ${visitors.length} visitors shown`}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="pb-2 pr-4">Visitor</th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">Profession</th>
              <th className="pb-2 pr-4">Gender</th>
              <th className="pb-2 pr-4">Age</th>
              <th className="pb-2 pr-4">Interests</th>
              <th className="pb-2 pr-4">Sessions</th>
              <th className="pb-2 pr-4">Events</th>
              <th className="pb-2 pr-4">Device</th>
              <th className="pb-2 pr-4">Location</th>
              <th className="pb-2">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {filteredVisitors.map((v, i) => (
              <Fragment key={v.visitorId || i}>
                <tr
                  className="border-b border-border/50 cursor-pointer hover:bg-muted/30"
                  onClick={() => {
                    const id = v.visitorId as string
                    if (!id) return
                    if (openVisitorId === id) {
                      setOpenVisitorId(null)
                      setDetail(null)
                      setFullHistoryEvents(null)
                      return
                    }
                    setOpenVisitorId(id)
                    loadVisitorDetail(id)
                  }}
                >
                  <td className="py-2 pr-4 font-mono text-xs">
                    {v.userId ? (
                      <span className="text-green-400">{String(v.userId).slice(0, 12)}...</span>
                    ) : (
                      <span className="text-muted-foreground">{String(v.visitorId || '').slice(0, 8)}... (anon)</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    {v.email ? <span className="text-purple-300">{v.email}</span> : '—'}
                  </td>
                  <td className="py-2 pr-4">{v.userRole || '—'}</td>
                  <td className="py-2 pr-4 text-xs">
                    {getDemographic(v.demographics, 'profession') || '—'}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    {getDemographic(v.demographics, 'gender') || '—'}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    {getDemographic(v.demographics, 'ageRange') || '—'}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    {getInterestCategories(v.interests).length ? (
                      <span className="text-muted-foreground">
                        {getInterestCategories(v.interests).slice(0, 3).join(', ')}
                        {getInterestCategories(v.interests).length > 3 ? '…' : ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 pr-4">{v.sessionCount}</td>
                  <td className="py-2 pr-4">{v.eventCount}</td>
                  <td className="py-2 pr-4 text-xs">{v.browser} / {v.os} / {v.deviceType}</td>
                  <td className="py-2 pr-4">{[v.city, v.country].filter(Boolean).join(', ') || '—'}</td>
                  <td className="py-2 text-xs text-muted-foreground">{v.lastSeen ? new Date(v.lastSeen).toLocaleString() : '—'}</td>
                </tr>

                {openVisitorId === v.visitorId && (
                  <tr className="border-b border-border/50">
                    <td className="py-3" colSpan={12}>
                      <div className="rounded-lg border bg-card p-3 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="text-sm font-medium">Visitor Details</div>
                          <div className="text-xs text-muted-foreground">
                            Click row to collapse
                          </div>
                        </div>

                        {detailLoading ? (
                          <div className="text-sm text-muted-foreground">Loading recent history…</div>
                        ) : detail?.success ? (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
                              <div className="rounded-md bg-muted/30 p-2">
                                <div className="text-xs text-muted-foreground">Account</div>
                                <div className="truncate">
                                  {detail.account?.email || 'Anonymous'}
                                </div>
                              </div>
                              <div className="rounded-md bg-muted/30 p-2">
                                <div className="text-xs text-muted-foreground">Profession</div>
                                <div className="truncate">
                                  {getDemographic(detail.profile?.demographics, 'profession') || '—'}
                                </div>
                              </div>
                              <div className="rounded-md bg-muted/30 p-2">
                                <div className="text-xs text-muted-foreground">Field of Study</div>
                                <div className="truncate">
                                  {getDemographic(detail.profile?.demographics, 'fieldOfStudy') || '—'}
                                </div>
                              </div>
                              <div className="rounded-md bg-muted/30 p-2">
                                <div className="text-xs text-muted-foreground">Onboarding</div>
                                <div>
                                  {detail.profile?.onboardingComplete ? (
                                    <Badge variant="outline" className="text-xs border-green-700 text-green-400 bg-green-900/20">Complete</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">Unknown/Incomplete</Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  {fullHistoryEvents
                                    ? `All events (${fullHistoryEvents.length} total)`
                                    : `Recent events (latest 50 in time window)`}
                                </div>
                                {!fullHistoryEvents && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2"
                                    disabled={fullHistoryLoading}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      loadFullHistory(v.visitorId)
                                    }}
                                  >
                                    {fullHistoryLoading ? (
                                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                    ) : (
                                      <History className="w-3 h-3 mr-1" />
                                    )}
                                    View full history
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-1 max-h-72 overflow-y-auto">
                                {(fullHistoryEvents || detail.events || []).slice(0, fullHistoryEvents ? 500 : 20).map((e: any) => (
                                  <div key={e.id} className="flex items-center gap-2 text-xs rounded-md border bg-background px-2 py-1">
                                    <Badge variant="outline" className="text-[10px]">{e.eventType}</Badge>
                                    <span className="truncate max-w-[180px] text-muted-foreground">{e.pagePath || '/'}</span>
                                    {e.elementText && (
                                      <span className="truncate max-w-[160px] text-purple-300">“{e.elementText}”</span>
                                    )}
                                    <span className="ml-auto whitespace-nowrap text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
                                  </div>
                                ))}
                                {(fullHistoryEvents || detail.events || []).length === 0 && (
                                  <div className="text-sm text-muted-foreground py-2">No events found.</div>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">No details available.</div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filteredVisitors.length === 0 && (
              <tr>
                <td colSpan={12} className="py-8 text-center text-muted-foreground">
                  {searchQuery || activeFilterCount > 0
                    ? 'No visitors match your search/filters.'
                    : 'No visitors found in this time window.'}
                </td>
              </tr>
            )}
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

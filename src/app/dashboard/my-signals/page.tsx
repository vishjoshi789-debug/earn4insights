'use client'

/**
 * Consumer Signal History
 * /dashboard/my-signals
 *
 * Shows the consumer's signal snapshots per category:
 * behavioral, demographic, psychographic, social.
 * Consent-gated: categories without consent show a "not consented" state
 * with a link to /dashboard/privacy to grant it.
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Activity, Loader2, AlertCircle, ShieldOff, Clock, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────

type Snapshot = {
  id?: string
  signalCategory: string
  signals: Record<string, unknown>
  snapshotAt: string
  triggeredBy: string
  schemaVersion?: string
}

type CategoryData = {
  snapshots: Snapshot[]
  reason?: 'consent_not_granted'
}

type SignalsResponse = {
  signals: Record<string, CategoryData>
}

type LatestResponse = {
  latest: Record<string, { signals: Record<string, unknown>; snapshotAt: string; triggeredBy: string } | null>
}

// ── Category config ───────────────────────────────────────────────

const CATEGORIES = [
  {
    key: 'behavioral',
    label: 'Behavioural',
    description: 'Engagement score, feedback frequency, sentiment, category interests.',
    consentCategory: 'behavioral',
  },
  {
    key: 'demographic',
    label: 'Demographic',
    description: 'Age range, gender, location, education, profession.',
    consentCategory: 'demographic',
  },
  {
    key: 'psychographic',
    label: 'Psychographic',
    description: 'Values, lifestyle, personality traits, aspirations.',
    consentCategory: 'psychographic',
  },
  {
    key: 'social',
    label: 'Social',
    description: 'Inferred interest signals from connected social accounts.',
    consentCategory: 'social',
  },
]

// ── Helpers ───────────────────────────────────────────────────────

function formatSignalValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function SignalKV({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return <p className="text-xs text-muted-foreground italic">No signal data</p>
  return (
    <dl className="space-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[160px_1fr] gap-2 text-xs">
          <dt className="text-muted-foreground font-medium truncate">{k}</dt>
          <dd className="text-foreground break-all">
            {typeof v === 'object' && v !== null
              ? <pre className="whitespace-pre-wrap font-mono text-[11px]">{JSON.stringify(v, null, 2)}</pre>
              : formatSignalValue(v)
            }
          </dd>
        </div>
      ))}
    </dl>
  )
}

// ── Component ─────────────────────────────────────────────────────

export default function MySignalsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [latest, setLatest] = useState<LatestResponse['latest']>({})
  const [history, setHistory] = useState<Record<string, CategoryData>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('behavioral')

  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && userRole && userRole !== 'consumer') router.push('/dashboard')
  }, [status, userRole, router])

  const fetchSignals = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [latestRes, historyRes] = await Promise.all([
        fetch('/api/consumer/signals?latestOnly=true'),
        fetch('/api/consumer/signals?limit=20'),
      ])

      if (!latestRes.ok || !historyRes.ok) throw new Error('Failed to load signals')

      const [latestData, historyData]: [LatestResponse, SignalsResponse] = await Promise.all([
        latestRes.json(),
        historyRes.json(),
      ])

      setLatest(latestData.latest ?? {})
      setHistory(historyData.signals ?? {})
      if (isRefresh) toast.success('Signals refreshed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && userRole === 'consumer') fetchSignals()
  }, [status, userRole, fetchSignals])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <Activity className="h-6 w-6" />
            My Signals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            See the interest and behaviour signals the platform has computed from your activity.
            Only categories you have consented to are shown.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => fetchSignals(true)}
        >
          {refreshing
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh</>
          }
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Category tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 sm:flex-nowrap sm:w-auto sm:h-10">
          {CATEGORIES.map((cat) => {
            const hist = history[cat.key]
            const hasData = hist?.snapshots && hist.snapshots.length > 0
            const noConsent = hist?.reason === 'consent_not_granted'
            return (
              <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5">
                {cat.label}
                {noConsent && <ShieldOff className="h-3 w-3 text-muted-foreground" />}
                {hasData && !noConsent && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {hist.snapshots.length}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {CATEGORIES.map((cat) => {
          const hist = history[cat.key]
          const latestSnap = latest[cat.key]
          const noConsent = hist?.reason === 'consent_not_granted'
          const snapshots = hist?.snapshots ?? []

          return (
            <TabsContent key={cat.key} value={cat.key} className="space-y-4 mt-4">
              {/* No consent state */}
              {noConsent && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
                    <ShieldOff className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">No consent for {cat.label} signals</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        {cat.description}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/privacy">Grant consent →</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Latest snapshot */}
              {!noConsent && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Latest Snapshot</CardTitle>
                      {latestSnap?.snapshotAt && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(latestSnap.snapshotAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    {latestSnap?.triggeredBy && (
                      <CardDescription className="text-xs">
                        Triggered by: <code className="text-[11px]">{latestSnap.triggeredBy}</code>
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {latestSnap?.signals
                      ? <SignalKV data={latestSnap.signals} />
                      : <p className="text-xs text-muted-foreground italic">No signals computed yet. Signals are updated daily.</p>
                    }
                  </CardContent>
                </Card>
              )}

              {/* History */}
              {!noConsent && snapshots.length > 1 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">
                      History
                      <Badge variant="secondary" className="ml-2 text-xs">{snapshots.length} snapshots</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      One snapshot is stored per computation run. Older snapshots show how your signals have changed over time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[320px]">
                      <div className="space-y-0 px-6">
                        {snapshots.slice(1).map((snap, i) => (
                          <div key={i}>
                            <div className="py-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {new Date(snap.snapshotAt).toLocaleString()}
                                </div>
                                <Badge variant="outline" className="text-[10px] px-1.5">
                                  {snap.triggeredBy}
                                </Badge>
                              </div>
                              <SignalKV data={snap.signals as Record<string, unknown>} />
                            </div>
                            {i < snapshots.length - 2 && <Separator />}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Empty — consented but no data yet */}
              {!noConsent && snapshots.length === 0 && !latestSnap && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <Activity className="h-7 w-7 text-muted-foreground" />
                    <p className="text-sm font-medium">No {cat.label.toLowerCase()} signals yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {cat.description} Signals are computed daily based on your activity.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

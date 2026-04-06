'use client'

/**
 * Brand ICP Detail / Edit Page
 * /dashboard/brand/icps/[icpId]
 *
 * Sections:
 *  1. ICP metadata header (name, description, matchThreshold)
 *  2. Criteria weight editor (IcpWeightEditor)
 *  3. Match leaderboard (top consumers from cached icp_match_scores)
 *  4. Score distribution chart (recharts BarChart)
 *  5. Bulk rescore trigger
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { IcpWeightEditor, type EditableCriterion } from '@/components/icp-weight-editor'
import {
  ArrowLeft, Target, Loader2, AlertCircle, RefreshCw, Trash2, Save,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────

type IcpAttributes = {
  version: string
  totalWeight: number
  criteria: Record<string, Omit<EditableCriterion, 'key'>>
}

type BrandIcp = {
  id: string
  name: string
  description: string | null
  matchThreshold: number
  isActive: boolean
  productId: string | null
  attributes: IcpAttributes
  createdAt: string
}

type MatchScore = {
  id: string
  consumerId: string
  matchScore: number
  isStale: boolean
  computedAt: string
  breakdown?: {
    consentGaps?: string[]
    explainability?: string
  }
}

// ── Score band helpers ─────────────────────────────────────────────

const BANDS = [
  { label: '90–100', min: 90, max: 100, color: '#22c55e' },
  { label: '80–89',  min: 80, max: 89,  color: '#84cc16' },
  { label: '70–79',  min: 70, max: 79,  color: '#eab308' },
  { label: '60–69',  min: 60, max: 69,  color: '#f97316' },
  { label: '<60',    min: 0,  max: 59,  color: '#ef4444' },
]

function buildDistribution(matches: MatchScore[]) {
  return BANDS.map((band) => ({
    ...band,
    count: matches.filter((m) => m.matchScore >= band.min && m.matchScore <= band.max).length,
  }))
}

// ── Page component ────────────────────────────────────────────────

export default function IcpDetailPage() {
  const { icpId } = useParams<{ icpId: string }>()
  const router = useRouter()
  const { data: session, status } = useSession()

  const [icp, setIcp] = useState<BrandIcp | null>(null)
  const [matches, setMatches] = useState<MatchScore[]>([])
  const [loadingIcp, setLoadingIcp] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Metadata edit state
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editThreshold, setEditThreshold] = useState('60')
  const [savingMeta, setSavingMeta] = useState(false)

  // Criteria save state
  const [savingCriteria, setSavingCriteria] = useState(false)

  // Bulk rescore state
  const [rescoring, setRescoring] = useState(false)

  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && userRole && userRole !== 'brand') router.push('/dashboard')
  }, [status, userRole, router])

  const fetchIcp = useCallback(async () => {
    try {
      setLoadingIcp(true)
      const res = await fetch(`/api/brand/icps/${icpId}`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to load ICP')
      }
      const data = await res.json()
      setIcp(data.icp)
      setEditName(data.icp.name)
      setEditDesc(data.icp.description ?? '')
      setEditThreshold(String(data.icp.matchThreshold))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoadingIcp(false)
    }
  }, [icpId])

  const fetchMatches = useCallback(async () => {
    try {
      setLoadingMatches(true)
      const res = await fetch(`/api/brand/icps/${icpId}/matches?limit=100&minScore=0`)
      if (!res.ok) return
      const data = await res.json()
      setMatches(data.matches ?? [])
    } finally {
      setLoadingMatches(false)
    }
  }, [icpId])

  useEffect(() => {
    if (status === 'authenticated' && userRole === 'brand') {
      fetchIcp()
      fetchMatches()
    }
  }, [status, userRole, fetchIcp, fetchMatches])

  // ── Save metadata ───────────────────────────────────────────────

  async function saveMeta() {
    const threshold = parseInt(editThreshold)
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      toast.error('Match threshold must be 0–100')
      return
    }
    setSavingMeta(true)
    try {
      const res = await fetch(`/api/brand/icps/${icpId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          matchThreshold: threshold,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to save')
      }
      const { icp: updated } = await res.json()
      setIcp(updated)
      toast.success('ICP metadata saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingMeta(false)
    }
  }

  // ── Save criteria ───────────────────────────────────────────────

  async function saveCriteria(
    criteria: Record<string, Omit<EditableCriterion, 'key'>>,
    totalWeight: number
  ) {
    setSavingCriteria(true)
    try {
      const res = await fetch(`/api/brand/icps/${icpId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attributes: {
            version: '1.0',
            totalWeight,
            criteria,
          },
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to save criteria')
      }
      const { icp: updated } = await res.json()
      setIcp(updated)
      toast.success('Criteria saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save criteria')
    } finally {
      setSavingCriteria(false)
    }
  }

  // ── Bulk rescore ────────────────────────────────────────────────

  async function handleRescore() {
    if (matches.length === 0) {
      toast.info('No cached consumers to rescore. Scores will be computed on next interaction.')
      return
    }

    const ids = matches.slice(0, 200).map((m) => m.consumerId)
    setRescoring(true)
    try {
      const res = await fetch(`/api/brand/icps/${icpId}/bulk-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerIds: ids }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Rescore failed')
      }
      const data = await res.json()
      toast.success(`Rescored ${data.scored} consumers`)
      await fetchMatches()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rescore failed')
    } finally {
      setRescoring(false)
    }
  }

  // ── Delete ICP ──────────────────────────────────────────────────

  async function handleDelete() {
    try {
      const res = await fetch(`/api/brand/icps/${icpId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to deactivate ICP')
      }
      toast.success('ICP deactivated')
      router.push('/dashboard/brand/icps')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate ICP')
    }
  }

  // ── Render ──────────────────────────────────────────────────────

  if (loadingIcp) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !icp) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error ?? 'ICP not found'}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/brand/icps">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to ICP Profiles
          </Link>
        </Button>
      </div>
    )
  }

  const distribution = buildDistribution(matches)
  const aboveThreshold = matches.filter((m) => m.matchScore >= icp.matchThreshold).length

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/brand/icps">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2 truncate">
            <Target className="h-5 w-5 shrink-0" />
            {icp.name}
          </h1>
        </div>
        <Badge variant={icp.isActive ? 'default' : 'secondary'}>
          {icp.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate ICP?</AlertDialogTitle>
              <AlertDialogDescription>
                This ICP will be deactivated and will no longer trigger alerts. Match scores are preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* ── 1. Metadata ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ICP Settings</CardTitle>
          <CardDescription>Name, description, and match threshold.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="meta-name">Name</Label>
              <Input
                id="meta-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-threshold">Match Threshold (%)</Label>
              <Input
                id="meta-threshold"
                type="number"
                min={0}
                max={100}
                value={editThreshold}
                onChange={(e) => setEditThreshold(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta-desc">Description</Label>
            <Input
              id="meta-desc"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <Button onClick={saveMeta} disabled={savingMeta} size="sm">
            {savingMeta
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
              : <><Save className="h-3.5 w-3.5 mr-1.5" /> Save Settings</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* ── 2. Weight editor ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criteria &amp; Weights</CardTitle>
          <CardDescription>
            All weights must sum to exactly 100. Required criteria that score 0 will zero the entire match score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IcpWeightEditor
            key={JSON.stringify(icp.attributes.criteria)}
            initialCriteria={icp.attributes.criteria}
            onSave={saveCriteria}
            saving={savingCriteria}
          />
        </CardContent>
      </Card>

      {/* ── 3 + 4. Match leaderboard + distribution ── */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Match Leaderboard</CardTitle>
                <CardDescription className="text-xs">
                  {aboveThreshold} above {icp.matchThreshold}% threshold
                </CardDescription>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={rescoring}>
                    {rescoring
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Rescoring…</>
                      : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Rescore All</>
                    }
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rescore all consumers?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will recompute scores for up to 200 cached consumers. It may take up to 20 seconds.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRescore}>Rescore</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            {loadingMatches ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : matches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No scored consumers yet. Scores are computed after consumers interact with your products.
              </p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {matches
                  .sort((a, b) => b.matchScore - a.matchScore)
                  .slice(0, 50)
                  .map((m, i) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="w-5 text-xs text-muted-foreground text-right shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-muted-foreground truncate">
                            Consumer #{m.consumerId.slice(0, 8)}…
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs font-medium">{m.matchScore}%</span>
                            {m.isStale && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">stale</Badge>
                            )}
                          </div>
                        </div>
                        <Progress
                          value={m.matchScore}
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribution chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Distribution</CardTitle>
            <CardDescription className="text-xs">
              How consumers are distributed across score bands
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMatches ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : matches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={distribution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value} consumers`, 'Count']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

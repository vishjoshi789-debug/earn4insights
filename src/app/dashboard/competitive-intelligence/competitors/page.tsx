'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Check, Plus, Trash2, ExternalLink, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { AddCompetitorDialog } from '../_components/AddCompetitorDialog'

type Competitor = {
  id: string
  competitorName: string
  competitorType: 'on_platform' | 'off_platform'
  competitorWebsite: string | null
  category: string
  isSystemSuggested: boolean
  isConfirmed: boolean
  isActive: boolean
  createdAt: string
  notes: string | null
}

export default function CompetitorsPage() {
  const [tracked, setTracked] = useState<Competitor[]>([])
  const [suggested, setSuggested] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDismiss, setConfirmDismiss] = useState<Competitor | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [trackedRes, suggestedRes] = await Promise.all([
        fetch('/api/brand/competitive-intelligence/competitors?activeOnly=true', { cache: 'no-store' }),
        fetch('/api/brand/competitive-intelligence/competitors/suggested', { cache: 'no-store' }),
      ])
      if (trackedRes.ok) {
        const json = await trackedRes.json()
        setTracked(json.competitors ?? [])
      }
      if (suggestedRes.ok) {
        const json = await suggestedRes.json()
        setSuggested(json.suggestions ?? [])
      }
    } catch {
      toast.error('Failed to load competitors')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function confirmSuggested(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/brand/competitive-intelligence/competitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isConfirmed: true, isActive: true }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Competitor confirmed')
      await fetchAll()
    } catch {
      toast.error('Could not confirm competitor')
    } finally {
      setBusyId(null)
    }
  }

  async function dismissCompetitor(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/brand/competitive-intelligence/competitors/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Competitor dismissed')
      await fetchAll()
    } catch {
      toast.error('Could not dismiss competitor')
    } finally {
      setBusyId(null)
      setConfirmDismiss(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/competitive-intelligence"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to intelligence
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tracked competitors</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Brands you track feed the scores, benchmarks, and daily insights on the dashboard.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add competitor
        </Button>
      </div>

      {suggested.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-500" /> Suggested competitors
            </CardTitle>
            <CardDescription>
              Brands we think you compete with based on category overlap. Confirm to track, or dismiss to remove.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggested.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{s.competitorName}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <Badge variant="secondary" className="capitalize">{s.category}</Badge>
                    <span>{s.competitorType === 'on_platform' ? 'On platform' : 'Off platform'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => confirmSuggested(s.id)}
                    disabled={busyId === s.id}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDismiss(s)}
                    disabled={busyId === s.id}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your competitors ({tracked.length})</CardTitle>
          <CardDescription>All active competitors feeding your intelligence dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          {tracked.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No competitors yet. Add one above to unlock scores and insights.
            </p>
          ) : (
            <div className="divide-y">
              {tracked.map((c) => (
                <div key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/competitive-intelligence/competitors/${c.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {c.competitorName}
                      </Link>
                      {c.isSystemSuggested && (
                        <Badge variant="secondary" className="text-[10px]">Suggested</Badge>
                      )}
                      {!c.isConfirmed && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px]">Unconfirmed</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <Badge variant="secondary" className="capitalize">{c.category}</Badge>
                      <span>{c.competitorType === 'on_platform' ? 'On platform' : 'Off platform'}</span>
                      {c.competitorWebsite && (
                        <a
                          href={c.competitorWebsite}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-slate-700"
                        >
                          {c.competitorWebsite.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/competitive-intelligence/competitors/${c.id}`}>View</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setConfirmDismiss(c)}
                      disabled={busyId === c.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddCompetitorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={fetchAll}
      />

      <AlertDialog open={!!confirmDismiss} onOpenChange={(v) => { if (!v) setConfirmDismiss(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss competitor?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDismiss?.competitorName} will be removed from your tracked list. Historical
              scores and insights stay in your reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDismiss && dismissCompetitor(confirmDismiss.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

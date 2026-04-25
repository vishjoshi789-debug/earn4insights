'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

type Frequency = 'daily' | 'weekly' | 'monthly' | 'none'

type Preferences = {
  digestFrequency: Frequency
  emailEnabled: boolean
  inAppEnabled: boolean
  categories: string[]
  alertTypes: string[]
}

type Competitor = { id: string; category: string; isActive: boolean; isConfirmed: boolean }

const ALERT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'new_product', label: 'New product launches' },
  { value: 'price_change', label: 'Price changes' },
  { value: 'new_deal', label: 'New deals or promotions' },
  { value: 'influencer_campaign', label: 'Influencer campaigns' },
  { value: 'sentiment_spike', label: 'Positive sentiment spikes' },
  { value: 'sentiment_drop', label: 'Negative sentiment drops' },
  { value: 'consumer_switch_to', label: 'Consumers switching to you' },
  { value: 'consumer_switch_from', label: 'Consumers switching away' },
  { value: 'market_share_change', label: 'Market share changes' },
  { value: 'new_community_post', label: 'New community posts' },
]

const FREQ_DESCRIPTIONS: Record<Frequency, string> = {
  daily: 'Run scoring + AI insights nightly. Generate a daily digest report and email it.',
  weekly: 'Run scoring + AI insights nightly. Generate a weekly summary every Monday and email it.',
  monthly: 'Run scoring + AI insights nightly. Summaries compile over a 30-day window.',
  none: 'Scoring and alerts still run, but no scheduled reports or emails are sent.',
}

const DEFAULT_PREFS: Preferences = {
  digestFrequency: 'weekly',
  emailEnabled: true,
  inAppEnabled: true,
  categories: [],
  alertTypes: [],
}

export default function CompetitiveSettingsPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS)
  const [trackedCategories, setTrackedCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [prefsRes, compRes] = await Promise.all([
        fetch('/api/brand/competitive-intelligence/digest-preferences', { cache: 'no-store' }),
        fetch('/api/brand/competitive-intelligence/competitors?activeOnly=true&confirmedOnly=true', { cache: 'no-store' }),
      ])
      if (prefsRes.ok) {
        const json = await prefsRes.json()
        const p = json.preferences
        if (p) {
          setPrefs({
            digestFrequency: (p.digestFrequency ?? 'weekly') as Frequency,
            emailEnabled: p.emailEnabled ?? true,
            inAppEnabled: p.inAppEnabled ?? true,
            categories: p.categories ?? [],
            alertTypes: p.alertTypes ?? [],
          })
        }
      }
      if (compRes.ok) {
        const json = await compRes.json()
        const cats = Array.from(
          new Set(((json.competitors ?? []) as Competitor[]).map((c) => c.category))
        ).filter(Boolean)
        setTrackedCategories(cats)
      }
    } catch {
      toast.error('Could not load preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }))
    setDirty(true)
  }

  function toggleCategory(cat: string) {
    setPrefs((p) => {
      const has = p.categories.includes(cat)
      const next = has ? p.categories.filter((c) => c !== cat) : [...p.categories, cat]
      return { ...p, categories: next }
    })
    setDirty(true)
  }

  function toggleAlertType(t: string) {
    setPrefs((p) => {
      const has = p.alertTypes.includes(t)
      const next = has ? p.alertTypes.filter((v) => v !== t) : [...p.alertTypes, t]
      return { ...p, alertTypes: next }
    })
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/brand/competitive-intelligence/digest-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to save')
      }
      toast.success('Preferences saved')
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const allCategoriesSelected = useMemo(
    () => prefs.categories.length === 0,
    [prefs.categories]
  )

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/dashboard/competitive-intelligence"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to intelligence
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Intelligence settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Control how competitive insights are scheduled, delivered, and filtered.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <span>
          Scoring and the privacy cohort floor (≥ 5) always apply — these settings only control
          scheduling, delivery channels, and opt-in filters.
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Digest frequency</CardTitle>
          <CardDescription>How often we assemble and email your competitive summary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="freq">Frequency</Label>
            <Select
              value={prefs.digestFrequency}
              onValueChange={(v) => update('digestFrequency', v as Frequency)}
            >
              <SelectTrigger id="freq" className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="none">None — scoring only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">{FREQ_DESCRIPTIONS[prefs.digestFrequency]}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery channels</CardTitle>
          <CardDescription>Where we send the digest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <div className="font-medium text-slate-900">Email</div>
              <p className="text-xs text-slate-500">Send digests to your account email.</p>
            </div>
            <Switch
              checked={prefs.emailEnabled}
              onCheckedChange={(v) => update('emailEnabled', Boolean(v))}
            />
          </div>
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <div className="font-medium text-slate-900">In-app</div>
              <p className="text-xs text-slate-500">Show insights and alerts on the dashboard.</p>
            </div>
            <Switch
              checked={prefs.inAppEnabled}
              onCheckedChange={(v) => update('inAppEnabled', Boolean(v))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category opt-in</CardTitle>
          <CardDescription>
            Limit AI insights and reports to specific categories. Leave blank to include every
            category you track.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {trackedCategories.length === 0 ? (
            <p className="text-sm text-slate-500">
              You're not tracking any competitors yet.{' '}
              <Link
                href="/dashboard/competitive-intelligence/competitors"
                className="text-indigo-600 hover:underline"
              >
                Add your first competitor
              </Link>{' '}
              to unlock category settings.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {allCategoriesSelected
                  ? `All ${trackedCategories.length} tracked categories are included.`
                  : `${prefs.categories.length} selected — only these will generate AI insights and reports.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {trackedCategories.map((cat) => {
                  const checked = prefs.categories.includes(cat)
                  return (
                    <label
                      key={cat}
                      className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-sm transition-colors ${
                        checked ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-900'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleCategory(cat)}
                      />
                      <span className="capitalize">{cat}</span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert filters</CardTitle>
          <CardDescription>
            Only these alert types will be written to your feed. Leave blank to receive every type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALERT_TYPES.map((t) => {
              const checked = prefs.alertTypes.includes(t.value)
              return (
                <label
                  key={t.value}
                  className={`flex cursor-pointer items-start gap-2 rounded border p-2.5 text-sm transition-colors ${
                    checked
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-900'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleAlertType(t.value)}
                    className="mt-0.5"
                  />
                  <span>{t.label}</span>
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {prefs.alertTypes.length === 0
              ? 'All alert types are enabled.'
              : `${prefs.alertTypes.length} selected.`}
          </p>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={fetchAll}
          disabled={saving || !dirty}
        >
          Discard changes
        </Button>
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save preferences
        </Button>
      </div>
    </div>
  )
}

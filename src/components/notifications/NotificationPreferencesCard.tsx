'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Bell, Mail, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Per-event notification preferences — the UI half of a control that has been
 * enforced in the backend the whole time.
 *
 * `dispatchToUser` has always consulted `getPreference` before every channel,
 * but NO page called `/api/notifications/preferences`, so every user was
 * pinned to the defaults (in-app ✓ / email ✓) with no way to change them. The
 * only way for a consumer to stop email was to press "spam" — which suppresses
 * their address at Resend, silently breaks their verification email, and
 * degrades the sending domain for everyone else. That is also a DPDP
 * withdrawal-of-consent obligation we were not meeting with live users.
 *
 * ── Two deliberate omissions ─────────────────────────────────────────────
 * 1. NO SMS TOGGLE. `sendSMS` in notificationService is a stub that throws
 *    ("SMS not yet implemented"). A switch here would be a control that
 *    silently does nothing — the exact false-affordance the §5 claims policy
 *    exists to prevent. Add it when SMS ships, not before.
 *
 * 2. CATEGORIES, NOT ~40 RAW EVENT TYPES. The preference table is keyed on
 *    exact event strings, but "influencer.milestone.completed" is not a
 *    choice a human can make. Each category writes every event type it covers
 *    in ONE request, so a category can't end up half-applied.
 */

type Channel = 'inApp' | 'email'

type PreferenceRow = {
  eventType: string
  inAppEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
}

type Category = {
  key: string
  label: string
  description: string
  /** Every event type this switch controls. Must exist in NOTIFIABLE_EVENT_TYPES. */
  events: string[]
}

// Only categories whose events actually have a live emitter are listed.
// `brand.member.active` and `brand.discount.created` are deliberately absent:
// their handlers are wired but nothing emits them (see CLAUDE.md §11), so a
// toggle would govern notifications that can never arrive.
const CONSUMER_CATEGORIES: Category[] = [
  {
    key: 'feedback_outcomes',
    label: 'When a brand acts on your feedback',
    description: 'You are told when feedback you submitted is marked as addressed.',
    events: ['consumer.feedback.addressed'],
  },
  {
    key: 'rewards',
    label: 'Rewards and redemptions',
    description: 'Confirmations when you redeem points.',
    events: ['consumer.reward.redeemed'],
  },
  {
    key: 'new_things',
    label: 'New products to review',
    description: 'Products launched by brands matching your profile.',
    events: ['brand.product.launched'],
  },
  {
    key: 'deals',
    label: 'Deals you saved',
    description: 'Reminders when a saved deal is about to expire.',
    events: ['deal.expired'],
  },
  {
    key: 'community',
    label: 'Your community posts',
    description: 'When a post you submitted is approved or rejected.',
    events: ['community.deal.approved', 'community.deal.rejected'],
  },
  {
    key: 'support',
    label: 'Support replies',
    description: 'Replies and status changes on tickets you opened.',
    events: ['support.admin_reply', 'support.ticket_updated', 'support.ticket_resolved'],
  },
]

const INFLUENCER_CATEGORIES: Category[] = [
  {
    key: 'campaigns',
    label: 'Campaigns and applications',
    description:
      'Invitations, application outcomes, content review results, and reviews of your work.',
    events: [
      'brand.campaign.launched',
      'brand.application.accepted',
      'brand.application.rejected',
      'influencer.content.approved',
      'influencer.content.rejected',
      'influencer.campaign.invited',
      'influencer.review.received',
    ],
  },
  {
    key: 'payouts',
    label: 'Payments and payouts',
    description: 'Escrow, milestone releases, and payout status.',
    events: [
      'payment.escrowed',
      'payment.released',
      'payment.payout.initiated',
      'payment.payout.completed',
      'payment.payout.failed',
    ],
  },
]

const BRAND_CATEGORIES: Category[] = [
  {
    key: 'feedback_in',
    label: 'Feedback and survey responses',
    description: 'When a consumer submits feedback or completes one of your surveys.',
    events: ['consumer.feedback.submitted', 'consumer.survey.completed'],
  },
  {
    key: 'alerts',
    label: 'Product alerts',
    description: 'Alert rules you configured, including negative-sentiment alerts.',
    events: ['brand.alert.fired'],
  },
  {
    key: 'intent',
    label: 'Consumer intent signals',
    description: 'When a consumer browses or searches for your product.',
    events: ['consumer.product.browsed', 'consumer.product.searched'],
  },
  {
    key: 'social',
    label: 'Social mentions',
    description: 'When your brand is mentioned on a monitored platform.',
    events: ['social.mention.detected'],
  },
  {
    key: 'brand_campaigns',
    label: 'Influencer campaigns',
    description: 'Applications, acceptances, milestones, and content awaiting review.',
    events: [
      'influencer.campaign.applied',
      'influencer.campaign.accepted',
      'influencer.milestone.completed',
      'brand.content.pending_review',
      'brand.content.auto_approved',
    ],
  },
  {
    key: 'brand_payments',
    label: 'Payments',
    description: 'Payment orders and failures.',
    events: ['payment.order.created', 'payment.failed'],
  },
  {
    key: 'brand_support',
    label: 'Support replies',
    description: 'Replies and status changes on tickets you opened.',
    events: ['support.admin_reply', 'support.ticket_updated', 'support.ticket_resolved'],
  },
]

export function NotificationPreferencesCard() {
  const { data: session } = useSession()
  const user = session?.user as
    | { role?: string; isInfluencer?: boolean; isBrand?: boolean }
    | undefined

  const isBrand = user?.role === 'brand' || user?.isBrand === true
  const isInfluencer = user?.role === 'influencer' || user?.isInfluencer === true

  const categories: Category[] = isBrand
    ? BRAND_CATEGORIES
    : [...CONSUMER_CATEGORIES, ...(isInfluencer ? INFLUENCER_CATEGORIES : [])]

  const [prefs, setPrefs] = useState<Record<string, PreferenceRow>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences')
      if (!res.ok) throw new Error()
      const data = await res.json()
      const map: Record<string, PreferenceRow> = {}
      for (const p of data.preferences ?? []) map[p.eventType] = p
      setPrefs(map)
    } catch {
      // Non-fatal: absent rows mean defaults, which is also what we render.
      console.error('[NotificationPreferences] Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /**
   * A category reads as ON only when EVERY event in it is on. Mixed state
   * (possible if the set of events in a category changes later) shows as off,
   * so one flip re-syncs the whole group rather than leaving it ambiguous.
   */
  const isOn = (cat: Category, channel: Channel): boolean =>
    cat.events.every((e) => {
      const row = prefs[e]
      if (!row) return true // no row = default = enabled
      return channel === 'inApp' ? row.inAppEnabled : row.emailEnabled
    })

  async function toggle(cat: Category, channel: Channel, value: boolean) {
    const savingKey = `${cat.key}:${channel}`
    setSaving(savingKey)

    // Optimistic — a settings switch that lags feels broken.
    const previous = prefs
    setPrefs((prev) => {
      const next = { ...prev }
      for (const e of cat.events) {
        const row = next[e] ?? {
          eventType: e,
          inAppEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
        }
        next[e] = {
          ...row,
          ...(channel === 'inApp' ? { inAppEnabled: value } : { emailEnabled: value }),
        }
      }
      return next
    })

    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTypes: cat.events,
          ...(channel === 'inApp' ? { inAppEnabled: value } : { emailEnabled: value }),
        }),
      })
      if (!res.ok) throw new Error((await res.json())?.error || 'Failed')
      toast.success(
        `${cat.label} — ${channel === 'inApp' ? 'in-app' : 'email'} ${value ? 'on' : 'off'}`
      )
    } catch (err: any) {
      setPrefs(previous) // roll back, don't leave a lie on screen
      toast.error(err?.message || 'Could not save that preference')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          What you get notified about
        </CardTitle>
        <CardDescription>
          Choose which updates reach you, and how. Changes apply immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">Turning email off is instant</p>
            <p>
              You never need to mark our email as spam to stop it. Security and
              account emails — like email verification and password resets — are
              always sent, because you need them to access your account.
            </p>
          </div>
        </div>

        {/* Channel column headers */}
        <div className="flex items-center gap-4 border-b border-border pb-2 text-xs font-medium text-muted-foreground">
          <span className="flex-1">Notification</span>
          <span className="flex w-16 items-center justify-center gap-1">
            <Bell className="h-3.5 w-3.5" /> In-app
          </span>
          <span className="flex w-16 items-center justify-center gap-1">
            <Mail className="h-3.5 w-3.5" /> Email
          </span>
        </div>

        {categories.map((cat) => (
          <div key={cat.key} className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{cat.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{cat.description}</p>
            </div>
            <div className="flex w-16 justify-center pt-1">
              <Switch
                checked={isOn(cat, 'inApp')}
                disabled={saving === `${cat.key}:inApp`}
                onCheckedChange={(v) => toggle(cat, 'inApp', v)}
                aria-label={`${cat.label} — in-app notifications`}
              />
            </div>
            <div className="flex w-16 justify-center pt-1">
              <Switch
                checked={isOn(cat, 'email')}
                disabled={saving === `${cat.key}:email`}
                onCheckedChange={(v) => toggle(cat, 'email', v)}
                aria-label={`${cat.label} — email notifications`}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

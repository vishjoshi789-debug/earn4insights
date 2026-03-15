'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Bell, Mail, Slack, Smartphone, Check, Loader2, BarChart3,
  MessageSquare, AlertCircle, TrendingUp, Eye, Zap, Info, MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────

type AlertRule = {
  id: string
  alertType: string
  channels: string[]
  enabled: boolean
  productId: string | null
}

type AlertTypeConfig = {
  label: string
  description: string
  icon: React.ElementType
  color: string
}

// ── Constants ──────────────────────────────────────────────────────

const ALERT_TYPES: Record<string, AlertTypeConfig> = {
  new_feedback: {
    label: 'New Feedback',
    description: 'When a consumer leaves feedback on any product',
    icon: MessageSquare,
    color: 'text-blue-600',
  },
  negative_feedback: {
    label: 'Negative Feedback',
    description: 'When negative sentiment is detected in feedback',
    icon: AlertCircle,
    color: 'text-red-600',
  },
  survey_complete: {
    label: 'Survey Completed',
    description: 'When a consumer completes one of your surveys',
    icon: BarChart3,
    color: 'text-green-600',
  },
  high_intent_consumer: {
    label: 'High Intent Consumer',
    description: 'When a consumer signals purchase intent or strong interest',
    icon: TrendingUp,
    color: 'text-purple-600',
  },
  watchlist_milestone: {
    label: 'Watchlist Milestone',
    description: 'When your product reaches a watchlist count threshold',
    icon: Eye,
    color: 'text-amber-600',
  },
  frustration_spike: {
    label: 'Frustration Spike',
    description: 'When an unusual volume of negative signals is detected',
    icon: Zap,
    color: 'text-orange-600',
  },
}



// ── Component ──────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as 'brand' | 'consumer' | undefined
  const isBrand = userRole === 'brand'

  // ── WhatsApp state (all users) ──────────────────────────────────
  const [waPhone, setWaPhone] = useState('')
  const [waEnabled, setWaEnabled] = useState(false)
  const [savingWa, setSavingWa] = useState(false)
  const [waSaved, setWaSaved] = useState(false)

  // ── Brand-only state ────────────────────────────────────────────
  const [rules, setRules] = useState<AlertRule[]>([])
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('')
  const [savingSlack, setSavingSlack] = useState(false)
  const [slackSaved, setSlackSaved] = useState(false)
  const [loadingRules, setLoadingRules] = useState(true)
  const [savingRule, setSavingRule] = useState<string | null>(null)

  // Helper: get the rule for a given alert type (global rule, no product filter)
  const getRuleForType = useCallback(
    (alertType: string): AlertRule | undefined =>
      rules.find((r) => r.alertType === alertType && !r.productId),
    [rules],
  )

  // Helper: does the rule for alertType include the given channel?
  const hasChannel = useCallback(
    (alertType: string, channel: string): boolean => {
      const rule = getRuleForType(alertType)
      // If no rule exists, defaults: in_app only
      return rule ? (rule.channels || []).includes(channel) : false
    },
    [getRuleForType],
  )

  // Load all settings on mount
  const loadSettings = useCallback(async () => {
    try {
      // WhatsApp prefs — all users
      const waRes = await fetch('/api/user/notification-settings')
      if (waRes.ok) {
        const data = await waRes.json()
        setWaPhone(data.whatsappPhoneNumber || '')
        setWaEnabled(data.whatsappEnabled || false)
      }
      // Brand-specific settings
      if (isBrand) {
        const [rulesRes, settingsRes] = await Promise.all([
          fetch('/api/brand/alert-rules'),
          fetch('/api/brand/notification-settings'),
        ])
        if (rulesRes.ok) {
          const data = await rulesRes.json()
          setRules(data.rules || [])
        }
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          setSlackWebhookUrl(data.slackWebhookUrl || '')
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingRules(false)
    }
  }, [isBrand])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Save WhatsApp preferences
  async function saveWhatsApp() {
    setSavingWa(true)
    try {
      const res = await fetch('/api/user/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappEnabled: waEnabled,
          whatsappPhoneNumber: waPhone.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      setWaSaved(true)
      setTimeout(() => setWaSaved(false), 3000)
      toast.success('WhatsApp preferences saved')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save WhatsApp settings')
    } finally {
      setSavingWa(false)
    }
  }

  // Toggle a channel on an alert type
  async function toggleChannel(alertType: string, channel: string, enabled: boolean) {
    setSavingRule(`${alertType}-${channel}`)
    try {
      const rule = getRuleForType(alertType)
      const currentChannels: string[] = rule?.channels || ['in_app']
      const newChannels = enabled
        ? [...new Set([...currentChannels, channel])]
        : currentChannels.filter((c) => c !== channel)

      // Always keep in_app
      if (!newChannels.includes('in_app')) newChannels.unshift('in_app')

      const res = await fetch('/api/brand/alert-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertType, channels: newChannels }),
      })

      if (!res.ok) throw new Error('Failed to save rule')
      const data = await res.json()

      // Upsert the rule in local state
      setRules((prev) => {
        const idx = prev.findIndex((r) => r.alertType === alertType && !r.productId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = data.rule
          return next
        }
        return [...prev, data.rule]
      })
      toast.success(`${ALERT_TYPES[alertType]?.label} ${channel} notifications ${enabled ? 'enabled' : 'disabled'}`)
    } catch {
      toast.error('Failed to save notification rule')
    } finally {
      setSavingRule(null)
    }
  }

  // Toggle the entire alert type on/off
  async function toggleAlertEnabled(alertType: string, enabled: boolean) {
    setSavingRule(`${alertType}-enabled`)
    try {
      const rule = getRuleForType(alertType)
      if (rule) {
        // Toggle existing rule
        const res = await fetch(`/api/brand/alert-rules?id=${encodeURIComponent(rule.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setRules((prev) => prev.map((r) => (r.id === rule.id ? data.rule : r)))
      } else {
        // Create rule with default channels
        const res = await fetch('/api/brand/alert-rules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alertType, channels: ['in_app'], enabled }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setRules((prev) => [...prev, data.rule])
      }
      toast.success(`${ALERT_TYPES[alertType]?.label} alerts ${enabled ? 'enabled' : 'disabled'}`)
    } catch {
      toast.error('Failed to update alert rule')
    } finally {
      setSavingRule(null)
    }
  }

  // Save Slack webhook URL
  async function saveSlackWebhook() {
    setSavingSlack(true)
    try {
      const res = await fetch('/api/brand/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackWebhookUrl: slackWebhookUrl.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      setSlackSaved(true)
      setTimeout(() => setSlackSaved(false), 3000)
      toast.success('Slack webhook URL saved')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save Slack webhook')
    } finally {
      setSavingSlack(false)
    }
  }

  const phoneInvalid = Boolean(waPhone && !/^\+[1-9]\d{6,14}$/.test(waPhone.trim()))

  return (
    <div className="max-w-3xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure how and where you receive real-time alerts.
        </p>
      </div>

      {/* ── WhatsApp (all users) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp Notifications
          </CardTitle>
          <CardDescription>
            {isBrand
              ? 'Receive real-time WhatsApp messages when consumers interact with your products.'
              : 'Receive real-time WhatsApp messages when new surveys are available for you.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">How it works</p>
              <p>
                We use Twilio to deliver messages to your WhatsApp number. Your number is only used
                for notifications and is never shared. You can opt out at any time.
              </p>
            </div>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Enable WhatsApp notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Requires a valid phone number below
              </p>
            </div>
            <Switch
              checked={waEnabled}
              disabled={!waPhone.trim() || phoneInvalid}
              onCheckedChange={setWaEnabled}
              aria-label="Enable WhatsApp notifications"
            />
          </div>

          {/* Phone number */}
          <div className="space-y-2">
            <Label htmlFor="wa-phone">WhatsApp Phone Number</Label>
            <div className="flex gap-2">
              <Input
                id="wa-phone"
                type="tel"
                placeholder="+14155552671"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                onClick={saveWhatsApp}
                disabled={savingWa || phoneInvalid}
                variant={waSaved ? 'default' : 'outline'}
                className="shrink-0"
              >
                {savingWa ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : waSaved ? (
                  <><Check className="h-4 w-4 mr-1" />Saved</>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
            {phoneInvalid && (
              <p className="text-xs text-destructive">
                Use international format, e.g. +14155552671
              </p>
            )}
            {!waPhone && (
              <p className="text-xs text-muted-foreground">
                Enter your number in international format (include country code).
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Brand-only: Alert Rules ── */}
      {isBrand && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alert Rules
            </CardTitle>
            <CardDescription>
              Choose which events trigger notifications and on which channels. In-app is always on.
              WhatsApp toggles require a phone number saved above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRules ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-1">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span>Alert type</span>
                  <span className="w-14 text-center">In-app</span>
                  <span className="w-14 text-center">Email</span>
                  <span className="w-14 text-center">Slack</span>
                  <span className="w-14 text-center">WhatsApp</span>
                </div>

                {Object.entries(ALERT_TYPES).map(([type, config]) => {
                  const rule = getRuleForType(type)
                  const isEnabled = rule ? rule.enabled : true
                  const Icon = config.icon

                  return (
                    <div
                      key={type}
                      className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-3 py-3 rounded-lg transition-colors ${
                        isEnabled ? 'hover:bg-muted/50' : 'opacity-50'
                      }`}
                    >
                      {/* Label + master toggle */}
                      <div className="flex items-start gap-3 min-w-0">
                        <Switch
                          checked={isEnabled}
                          disabled={savingRule === `${type}-enabled`}
                          onCheckedChange={(v) => toggleAlertEnabled(type, v)}
                          aria-label={`Toggle ${config.label}`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                            <span className="text-sm font-medium">{config.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {config.description}
                          </p>
                        </div>
                      </div>

                      {/* In-app — always on */}
                      <div className="w-14 flex justify-center">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Always
                        </Badge>
                      </div>

                      {/* Email */}
                      <div className="w-14 flex justify-center">
                        {savingRule === `${type}-email` ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            checked={hasChannel(type, 'email')}
                            disabled={!isEnabled}
                            onCheckedChange={(v) => toggleChannel(type, 'email', v)}
                            aria-label={`Email for ${config.label}`}
                          />
                        )}
                      </div>

                      {/* Slack */}
                      <div className="w-14 flex justify-center">
                        {savingRule === `${type}-slack` ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            checked={hasChannel(type, 'slack')}
                            disabled={!isEnabled || !slackWebhookUrl}
                            onCheckedChange={(v) => toggleChannel(type, 'slack', v)}
                            aria-label={`Slack for ${config.label}`}
                          />
                        )}
                      </div>

                      {/* WhatsApp */}
                      <div className="w-14 flex justify-center">
                        {savingRule === `${type}-whatsapp` ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            checked={hasChannel(type, 'whatsapp')}
                            disabled={!isEnabled || !waPhone || phoneInvalid || !waEnabled}
                            onCheckedChange={(v) => toggleChannel(type, 'whatsapp', v)}
                            aria-label={`WhatsApp for ${config.label}`}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Consumer — survey notification info */}
      {!isBrand && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Survey Notifications
            </CardTitle>
            <CardDescription>
              You'll receive WhatsApp messages when brands you follow publish new surveys. Enable
              WhatsApp above to activate real-time alerts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4 shrink-0" />
              <span>Notifications are sent instantly when a new survey matches your interests.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Brand-only: Slack ── */}
      {isBrand && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Slack className="h-5 w-5" />
              Slack Integration
            </CardTitle>
            <CardDescription>
              Connect a Slack channel to receive real-time alerts in your team workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">How to set up</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Go to your Slack workspace → Apps → Incoming Webhooks</li>
                  <li>Click &quot;Add to Slack&quot; and choose a channel</li>
                  <li>Copy the webhook URL and paste it below</li>
                </ol>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slack-webhook">Slack Incoming Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  id="slack-webhook"
                  type="url"
                  placeholder="https://hooks.slack.com/services/T.../B.../..."
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={saveSlackWebhook}
                  disabled={savingSlack}
                  variant={slackSaved ? 'default' : 'outline'}
                  className="shrink-0"
                >
                  {savingSlack ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : slackSaved ? (
                    <><Check className="h-4 w-4 mr-1" />Saved</>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
              {slackWebhookUrl && !slackWebhookUrl.startsWith('https://hooks.slack.com/') && (
                <p className="text-xs text-destructive">
                  URL must start with https://hooks.slack.com/
                </p>
              )}
              {!slackWebhookUrl && (
                <p className="text-xs text-muted-foreground">
                  Slack toggles in the alert rules table will be enabled once you save a webhook URL.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Email info (all users) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Sent to {(session?.user as any)?.email || 'your account email'}. In-app alerts appear in
            the{' '}
            {isBrand ? (
              <a href="/dashboard/alerts" className="underline underline-offset-2">Alerts</a>
            ) : (
              'Notifications'
            )}{' '}
            section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Email notifications are sent automatically for all enabled alert types. No additional
            setup required.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

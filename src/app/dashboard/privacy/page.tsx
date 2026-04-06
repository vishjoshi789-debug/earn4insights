'use client'

/**
 * Consumer Privacy & Consent Management
 * /dashboard/privacy
 *
 * Displays all 12 data categories grouped into 3 tiers.
 * Consumers can grant or revoke consent per category independently.
 *
 * GDPR Art. 7 — proof of consent stored (version, date, IP, UA)
 * GDPR Art. 9 — explicit consent required for sensitive_* categories
 * DPDP §6     — notice + consent before collection
 * DPDP §12    — right to withdraw consent at any time
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ShieldCheck, ShieldAlert, Loader2, AlertCircle, Info, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Consent category metadata ─────────────────────────────────────

type ConsentRecord = {
  dataCategory: string
  granted: boolean
  grantedAt: string | null
  revokedAt: string | null
  consentVersion: string | null
  purpose: string | null
  legalBasis: string | null
  isSensitive: boolean
}

type Tier = {
  label: string
  description: string
  categories: {
    key: string
    label: string
    purpose: string
    examples: string
  }[]
}

const TIERS: Tier[] = [
  {
    label: 'Platform Essentials',
    description: 'Core platform functionality — tracking, recommendations, and communications.',
    categories: [
      {
        key: 'tracking',
        label: 'On-Platform Tracking',
        purpose: 'Tracking your activity within this platform (page views, clicks, survey completions).',
        examples: 'Which surveys you started, products you viewed.',
      },
      {
        key: 'personalization',
        label: 'Personalisation',
        purpose: 'Tailoring product recommendations, survey matching, and feed ordering to your profile.',
        examples: 'Showing surveys relevant to your age group and interests.',
      },
      {
        key: 'analytics',
        label: 'Usage Analytics',
        purpose: 'Aggregate analysis of how you use the platform to improve features.',
        examples: 'Which features are used most, where users drop off.',
      },
      {
        key: 'marketing',
        label: 'Marketing Communications',
        purpose: 'Sending you promotional emails, newsletters, and product announcements.',
        examples: 'New survey campaigns, reward promotions.',
      },
    ],
  },
  {
    label: 'Insight Signals',
    description: 'Richer signals that improve your ICP match scores and the quality of insights brands receive.',
    categories: [
      {
        key: 'behavioral',
        label: 'Behavioural Signals',
        purpose: 'Analysing your feedback patterns, engagement score, and category interests.',
        examples: 'How often you give feedback, sentiment trends, top categories.',
      },
      {
        key: 'demographic',
        label: 'Demographic Profile',
        purpose: 'Using your age, gender, location, education, and profession for audience matching.',
        examples: 'Age range, city, profession from your onboarding profile.',
      },
      {
        key: 'psychographic',
        label: 'Psychographic Profile',
        purpose: 'Your values, lifestyle preferences, personality traits, and aspirations.',
        examples: 'Sustainability-focused, early adopter, family-oriented.',
      },
      {
        key: 'social',
        label: 'Social Signals',
        purpose: 'Interest signals inferred from connected social accounts (public data only).',
        examples: 'Topics you follow on LinkedIn.',
      },
    ],
  },
  {
    label: 'Sensitive Personal Data',
    description:
      'GDPR Art. 9 / DPDP "sensitive personal data" — stored encrypted, independently deletable, and require explicit consent.',
    categories: [
      {
        key: 'sensitive_health',
        label: 'Health Interests',
        purpose: 'Matching you with health and wellness brands based on your health interests.',
        examples: 'Fitness, nutrition, mental wellness preferences.',
      },
      {
        key: 'sensitive_dietary',
        label: 'Dietary Preferences',
        purpose: 'Matching you with food and lifestyle brands relevant to your diet.',
        examples: 'Vegan, gluten-free, Jain, halal dietary preferences.',
      },
      {
        key: 'sensitive_religion',
        label: 'Religion & Faith',
        purpose: 'Matching you with brands relevant to your religious practices and observances.',
        examples: 'Religious festivals, prayer accessories, faith-aligned brands.',
      },
      {
        key: 'sensitive_caste',
        label: 'Community / Caste',
        purpose: 'Enabling community-specific brand matching for relevant products and services.',
        examples: 'Community-specific food, cultural products.',
      },
    ],
  },
]

const CONSENT_VERSION = 'v2.1'

// ── Component ─────────────────────────────────────────────────────

export default function PrivacyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [consents, setConsents] = useState<Record<string, ConsentRecord>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  // Revoke confirmation for sensitive categories
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null)

  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && userRole && userRole !== 'consumer') router.push('/dashboard')
  }, [status, userRole, router])

  const fetchConsents = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/consumer/consent')
      if (!res.ok) throw new Error('Failed to load consent records')
      const data = await res.json()
      const map: Record<string, ConsentRecord> = {}
      for (const c of data.consents) map[c.dataCategory] = c
      setConsents(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && userRole === 'consumer') fetchConsents()
  }, [status, userRole, fetchConsents])

  async function grantConsent(category: string, isSensitive: boolean) {
    setToggling(category)
    try {
      const res = await fetch('/api/consumer/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataCategory: category,
          purpose: TIERS.flatMap((t) => t.categories).find((c) => c.key === category)?.purpose ?? '',
          consentVersion: CONSENT_VERSION,
          legalBasis: isSensitive ? 'explicit_consent' : 'explicit_consent',
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to grant consent')
      }
      const { consent } = await res.json()
      setConsents((prev) => ({ ...prev, [category]: { ...prev[category], ...consent } }))
      toast.success(`Consent granted for ${getCategoryLabel(category)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to grant consent')
    } finally {
      setToggling(null)
    }
  }

  async function revokeConsent(category: string) {
    setToggling(category)
    setRevokeConfirm(null)
    try {
      const res = await fetch(`/api/consumer/consent?category=${encodeURIComponent(category)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to revoke consent')
      }
      setConsents((prev) => ({
        ...prev,
        [category]: { ...prev[category], granted: false, revokedAt: new Date().toISOString() },
      }))
      toast.success(`Consent revoked for ${getCategoryLabel(category)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke consent')
    } finally {
      setToggling(null)
    }
  }

  function handleToggle(category: string, isSensitive: boolean, currentlyGranted: boolean) {
    if (currentlyGranted) {
      // Always confirm before revoking — sensitive ones get a stronger warning
      setRevokeConfirm(category)
    } else {
      grantConsent(category, isSensitive)
    }
  }

  function isGranted(category: string): boolean {
    const r = consents[category]
    if (!r) return false
    return r.granted && !r.revokedAt
  }

  function getCategoryLabel(category: string): string {
    return TIERS.flatMap((t) => t.categories).find((c) => c.key === category)?.label ?? category
  }

  const revokeCategory = revokeConfirm ? consents[revokeConfirm] : null
  const revokeIsSensitive = revokeCategory?.isSensitive ?? false

  const grantedCount = Object.values(consents).filter((c) => c.granted && !c.revokedAt).length
  const totalCount = 12

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          Privacy &amp; Consent
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control exactly what data you share. You can revoke any consent at any time —
          it takes effect immediately.
        </p>
      </div>

      {/* Summary bar */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">{grantedCount} of {totalCount} categories consented</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Consent version {CONSENT_VERSION} · GDPR Art. 7 + DPDP §6
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Consent tiers */}
      {TIERS.map((tier, tierIdx) => (
        <Card key={tierIdx}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {tier.label.includes('Sensitive') && (
                <ShieldAlert className="h-4 w-4 text-amber-500" />
              )}
              {tier.label}
            </CardTitle>
            <CardDescription className="text-xs">{tier.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {tier.categories.map((cat, catIdx) => {
              const record = consents[cat.key]
              const granted = isGranted(cat.key)
              const isSensitive = record?.isSensitive ?? cat.key.startsWith('sensitive_')
              const isLoading = toggling === cat.key

              return (
                <div key={cat.key}>
                  {catIdx > 0 && <Separator />}
                  <div className="flex items-start gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{cat.label}</span>
                        {isSensitive && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600">
                            Sensitive
                          </Badge>
                        )}
                        {granted && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-green-700 bg-green-50">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">{cat.purpose}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        e.g. {cat.examples}
                      </p>
                      {granted && record?.grantedAt && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Granted {new Date(record.grantedAt).toLocaleDateString()} · v{record.consentVersion ?? CONSENT_VERSION}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center pt-0.5 shrink-0">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={granted}
                          onCheckedChange={() => handleToggle(cat.key, isSensitive, granted)}
                          aria-label={`${granted ? 'Revoke' : 'Grant'} consent for ${cat.label}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      {/* Legal note */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        Your consent choices are legally binding records under GDPR Art. 7 and India DPDP Act 2023 §6.
        Revoking consent stops future data collection for that category and triggers deletion of associated data.
        To request full account erasure, visit{' '}
        <a href="/dashboard/settings" className="underline underline-offset-2">Settings</a>.
      </p>

      {/* Revoke confirmation dialog */}
      <AlertDialog
        open={!!revokeConfirm}
        onOpenChange={(open) => { if (!open) setRevokeConfirm(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {revokeIsSensitive && <ShieldAlert className="h-5 w-5 text-amber-500" />}
              Revoke consent for {revokeConfirm ? getCategoryLabel(revokeConfirm) : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeIsSensitive
                ? 'This is a sensitive data category. Revoking consent will immediately soft-delete any stored sensitive attributes in this category. They will be permanently deleted after 30 days.'
                : 'Revoking consent will stop future data collection for this category and mark your ICP match scores as stale for recomputation.'}
              {' '}This takes effect immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep consent</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => revokeConfirm && revokeConsent(revokeConfirm)}
            >
              Revoke consent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

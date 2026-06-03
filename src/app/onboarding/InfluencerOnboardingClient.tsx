'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { toast } from 'sonner'
import {
  Loader2, Upload, X, Sparkles, ArrowRight, ArrowLeft, Check,
  User, Globe, Wallet, BarChart3, Megaphone,
  Instagram, Youtube, Twitter, Linkedin, Music2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProgressIndicator } from '@/components/ProgressIndicator'
import { Badge } from '@/components/ui/badge'

import {
  saveProfileBasicsAction,
  saveSocialHandlesAction,
  saveAudienceAndRatesAction,
  completeInfluencerOnboardingAction,
} from './influencer-onboarding.actions'

import {
  INFLUENCER_NICHES,
  INFLUENCER_CONTENT_TYPES,
  INFLUENCER_CURRENCIES,
  AGE_BRACKET_KEYS,
  GENDER_KEYS,
  NICHE_LABELS,
  CONTENT_TYPE_LABELS,
  AGE_BRACKET_LABELS,
  GENDER_LABELS,
} from '@/lib/validation/influencer-onboarding'

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'e4i_influencer_onboarding_draft'
// 5 MB cap — accommodates modern phone photos (iPhone 12+ / Android
// flagships routinely produce 3–5 MB JPEGs). Matches server-side
// PHOTO_MAX_BYTES in /api/uploads/influencer-photo/route.ts. Brand
// logos remain capped at 2 MB on their own route because logos are
// usually small graphics.
const PHOTO_MAX_BYTES = 5 * 1024 * 1024
const PHOTO_ACCEPT = 'image/png,image/jpeg,image/webp'

const PROGRESS_STEPS = [
  { id: 1, title: 'Welcome',  description: 'Get started' },
  { id: 2, title: 'Profile',  description: 'About you' },
  { id: 3, title: 'Social',   description: 'Your platforms' },
  { id: 4, title: 'Audience', description: 'Reach & rates' },
  { id: 5, title: 'Payouts',  description: 'Get paid' },
  { id: 6, title: 'Done',     description: "You're all set" },
]

// Top countries (Q5) — ISO-2 codes. India-first per the platform's
// audience, plus the obvious globals.
const TOP_COUNTRY_OPTIONS: Array<{ code: string; name: string }> = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SG', name: 'Singapore' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
]

// ─── Draft persistence ───────────────────────────────────────────

interface AudienceDemographicsDraft {
  ageBrackets?: Partial<Record<(typeof AGE_BRACKET_KEYS)[number], number>>
  gender?: Partial<Record<(typeof GENDER_KEYS)[number], number>>
  topCountries?: string[]
}

interface PlatformStats {
  followerCount?: number | null
  engagementRate?: number | null
}

interface DraftState {
  step?: number
  // Step 2 — profile basics
  displayName?: string
  bio?: string
  niche?: string[]
  location?: string
  profileImageUrl?: string
  // Step 3 — social handles
  instagramHandle?: string
  youtubeHandle?: string
  twitterHandle?: string
  linkedinHandle?: string
  tiktokHandle?: string
  // Step 4 — audience + rates
  baseRate?: string  // string for input ergonomics; submit converts to paise
  currency?: string
  contentTypes?: string[]
  socialStats?: {
    instagram?: PlatformStats
    youtube?: PlatformStats
    twitter?: PlatformStats
    linkedin?: PlatformStats
    tiktok?: PlatformStats
  }
  audienceDemographics?: AudienceDemographicsDraft
}

function loadDraft(): DraftState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DraftState) : {}
  } catch {
    return {}
  }
}

function saveDraft(draft: DraftState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* quota exceeded — ignore */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function pct(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function sumPct(obj: Record<string, number> | undefined): number {
  if (!obj) return 0
  return Object.values(obj).reduce((acc, n) => acc + pct(n), 0)
}

// Tone the "% remaining" pill based on the running sum (Q5 spec).
function remainingTone(sum: number): { label: string; cls: string } {
  if (sum === 0) return { label: '0% allocated', cls: 'bg-muted text-muted-foreground' }
  if (sum > 100) return { label: `Over by ${(sum - 100).toFixed(0)}%`, cls: 'bg-destructive/10 text-destructive' }
  if (sum === 100) return { label: '100% allocated', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
  if (sum >= 50) return { label: `${(100 - sum).toFixed(0)}% remaining`, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
  return { label: `${(100 - sum).toFixed(0)}% remaining`, cls: 'bg-muted text-muted-foreground' }
}

// ─── Main wizard ─────────────────────────────────────────────────

interface InitialProfile {
  displayName?: string | null
  bio?: string | null
  niche?: string[] | null
  location?: string | null
  profileImageUrl?: string | null
  instagramHandle?: string | null
  youtubeHandle?: string | null
  twitterHandle?: string | null
  linkedinHandle?: string | null
  tiktokHandle?: string | null
  baseRate?: number | null      // paise
  currency?: string | null
  contentTypes?: string[] | null
  audienceDemographics?: {
    ageBrackets?: Record<string, number>
    gender?: Record<string, number>
    topCountries?: string[]
  } | null
  onboardingCompleted?: boolean
}

interface Props {
  initial: InitialProfile | null
  userName?: string | null
}

export default function InfluencerOnboardingClient({ initial, userName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  // Hydration-safe mount.
  const [hydrated, setHydrated] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<DraftState>({})

  // Q7 — when a grandfathered legacy influencer (or anyone with an
  // existing profile from earlier flows) mounts the wizard, prefill
  // every step from DB. The "Save and continue" button on each step
  // still saves + advances even when no edits are made, so a quick
  // click-through still marks onboarding_completed=true at the end.
  useEffect(() => {
    const draft = loadDraft()
    setStep(Math.min(Math.max(draft.step ?? 1, 1), PROGRESS_STEPS.length))
    setForm({
      displayName: initial?.displayName ?? draft.displayName ?? userName ?? '',
      bio: initial?.bio ?? draft.bio ?? '',
      niche: initial?.niche ?? draft.niche ?? [],
      location: initial?.location ?? draft.location ?? '',
      profileImageUrl: initial?.profileImageUrl ?? draft.profileImageUrl ?? '',
      instagramHandle: initial?.instagramHandle ?? draft.instagramHandle ?? '',
      youtubeHandle: initial?.youtubeHandle ?? draft.youtubeHandle ?? '',
      twitterHandle: initial?.twitterHandle ?? draft.twitterHandle ?? '',
      linkedinHandle: initial?.linkedinHandle ?? draft.linkedinHandle ?? '',
      tiktokHandle: initial?.tiktokHandle ?? draft.tiktokHandle ?? '',
      baseRate:
        initial?.baseRate != null
          ? String(initial.baseRate / 100)
          : draft.baseRate ?? '',
      currency: initial?.currency ?? draft.currency ?? 'INR',
      contentTypes: initial?.contentTypes ?? draft.contentTypes ?? [],
      audienceDemographics:
        initial?.audienceDemographics ?? draft.audienceDemographics ?? {},
      socialStats: draft.socialStats ?? {},
    })
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveDraft({ ...form, step })
  }, [form, step, hydrated])

  const update = useCallback(<K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }, [])

  // ── Validation per step (mirrors server Zod) ─────────────────
  const step2Valid =
    (form.displayName?.trim().length ?? 0) >= 2 &&
    (form.niche?.length ?? 0) >= 1

  // Sum tolerance — soft validation (Q5).
  const ageSum = sumPct(form.audienceDemographics?.ageBrackets as Record<string, number> | undefined)
  const genderSum = sumPct(form.audienceDemographics?.gender as Record<string, number> | undefined)

  // ── Photo upload (Vercel Blob client) ────────────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const handlePhotoUpload = async (file: File) => {
    setPhotoError(null)
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoError('Photo must be 5 MB or smaller')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setPhotoError('Photo must be PNG, JPG, or WEBP')
      return
    }
    setPhotoUploading(true)
    try {
      const blob = await upload(`influencer-photos/${Date.now()}-${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/uploads/influencer-photo',
      })
      update('profileImageUrl', blob.url)
    } catch (err: any) {
      setPhotoError(err?.message ?? 'Upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  // ── Step nav handlers ────────────────────────────────────────
  const goToStep3 = () => {
    startTransition(async () => {
      const res = await saveProfileBasicsAction({
        displayName: form.displayName ?? '',
        bio: form.bio || undefined,
        niche: form.niche ?? [],
        location: form.location || undefined,
        profileImageUrl: form.profileImageUrl || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setStep(3)
    })
  }

  const goToStep4 = () => {
    startTransition(async () => {
      const res = await saveSocialHandlesAction({
        instagramHandle: form.instagramHandle || undefined,
        youtubeHandle: form.youtubeHandle || undefined,
        twitterHandle: form.twitterHandle || undefined,
        linkedinHandle: form.linkedinHandle || undefined,
        tiktokHandle: form.tiktokHandle || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setStep(4)
    })
  }

  const goToStep5 = () => {
    startTransition(async () => {
      const baseRateNum = form.baseRate ? Math.round(parseFloat(form.baseRate) * 100) : null
      const res = await saveAudienceAndRatesAction({
        baseRate: baseRateNum != null && !Number.isNaN(baseRateNum) ? baseRateNum : undefined,
        currency: form.currency || undefined,
        contentTypes: form.contentTypes ?? [],
        socialStats: form.socialStats ?? undefined,
        audienceDemographics: form.audienceDemographics ?? undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setStep(5)
    })
  }

  const completeOnboarding = () => {
    startTransition(async () => {
      const res = await completeInfluencerOnboardingAction({})
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      clearDraft()
      setStep(6)
    })
  }

  const goToDashboard = () => {
    router.push('/dashboard')
    router.refresh()
  }

  // The wizard renders nothing until hydrated to avoid flicker between
  // server-rendered initial state and sessionStorage rehydration.
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-8 px-4 sm:px-6">
      {/* Progress indicator (hidden on welcome + done) */}
      {step > 1 && step < 6 && (
        <div className="mb-6">
          <ProgressIndicator currentStep={step} steps={PROGRESS_STEPS} />
        </div>
      )}

      {/* ─── Step 1 — Welcome ───────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white">
              <Sparkles className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl">
              Welcome to Earn4Insights, {userName || 'there'}! 🎉
            </CardTitle>
            <CardDescription className="text-base">
              You're about to set up your influencer profile. Takes ~3 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              We'll guide you through:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                <span>Your professional profile</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                <span>Social handles and audience</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                <span>Rates and content offerings</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                <span>Payout setup (optional, can add later)</span>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground pt-1">
              Let's get you ready to earn from genuine brand campaigns.
            </p>
            <Button onClick={() => setStep(2)} className="w-full" size="lg">
              Let's go <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Step 2 — Profile basics ───────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-violet-500" /> Your profile
            </CardTitle>
            <CardDescription>
              Brands see this when matching your profile to campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Profile photo */}
            <div className="space-y-2">
              <Label>Profile photo</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                  {form.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PHOTO_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handlePhotoUpload(file)
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                  >
                    {photoUploading
                      ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Uploading…</>
                      : <><Upload className="h-3.5 w-3.5 mr-2" /> Upload</>}
                  </Button>
                  {form.profileImageUrl && !photoUploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => update('profileImageUrl', '')}
                      className="text-muted-foreground"
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, or WEBP. 5 MB max.
                  </p>
                </div>
              </div>
              {photoError && <p className="text-xs text-destructive">{photoError}</p>}
            </div>

            {/* Display name */}
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name *</Label>
              <Input
                id="displayName"
                value={form.displayName ?? ''}
                onChange={(e) => update('displayName', e.target.value)}
                placeholder="The name brands will see"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <Label htmlFor="bio">
                Short bio <span className="text-muted-foreground text-xs">({(form.bio?.length ?? 0)}/200)</span>
              </Label>
              <Textarea
                id="bio"
                value={form.bio ?? ''}
                onChange={(e) => update('bio', e.target.value.slice(0, 200))}
                rows={3}
                placeholder="What you're known for, in a sentence or two."
              />
            </div>

            {/* Niches */}
            <div className="space-y-2">
              <Label>Niches * <span className="text-muted-foreground text-xs">(pick 1–5)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {INFLUENCER_NICHES.map((n) => {
                  const selected = (form.niche ?? []).includes(n)
                  return (
                    <button
                      type="button"
                      key={n}
                      onClick={() => {
                        const current = form.niche ?? []
                        const next = selected
                          ? current.filter((x) => x !== n)
                          : current.length < 5
                            ? [...current, n]
                            : current
                        update('niche', next)
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-violet-500 text-white border-violet-500'
                          : 'border-input hover:border-violet-400 hover:bg-violet-500/5'
                      }`}
                    >
                      {NICHE_LABELS[n]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location ?? ''}
                onChange={(e) => update('location', e.target.value)}
                placeholder="e.g. Mumbai, India"
              />
            </div>

            {/* Nav */}
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={goToStep3}
                disabled={!step2Valid || isPending}
                className="ml-auto"
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save and continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Step 3 — Social handles ───────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-pink-500" /> Your platforms
            </CardTitle>
            <CardDescription>
              Where do you create content? All optional — we&apos;ll auto-verify these as integrations come online.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram</Label>
              <Input
                value={form.instagramHandle ?? ''}
                onChange={(e) => update('instagramHandle', e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Youtube className="h-3.5 w-3.5" /> YouTube</Label>
              <Input
                value={form.youtubeHandle ?? ''}
                onChange={(e) => update('youtubeHandle', e.target.value)}
                placeholder="@channel"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Twitter className="h-3.5 w-3.5" /> Twitter / X</Label>
              <Input
                value={form.twitterHandle ?? ''}
                onChange={(e) => update('twitterHandle', e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</Label>
              <Input
                value={form.linkedinHandle ?? ''}
                onChange={(e) => update('linkedinHandle', e.target.value)}
                placeholder="linkedin.com/in/handle"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Music2 className="h-3.5 w-3.5" /> TikTok</Label>
              <Input
                value={form.tiktokHandle ?? ''}
                onChange={(e) => update('tiktokHandle', e.target.value)}
                placeholder="@handle"
              />
            </div>

            <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-3">
              We&apos;ll auto-verify these as integrations come online — self-reported for now.
            </p>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={goToStep4} disabled={isPending} className="ml-auto">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save and continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Step 4 — Audience + Rates ─────────────────────── */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-500" /> Audience &amp; rates
            </CardTitle>
            <CardDescription>
              Help brands match you to the right campaigns. Everything here is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Per-platform follower counts + engagement rate */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Reach per platform</h3>
                <p className="text-xs text-muted-foreground">Self-reported. We&apos;ll verify automatically when API integrations are live.</p>
              </div>
              {(['instagram', 'youtube', 'twitter', 'linkedin'] as const).map((p) => (
                <div key={p} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div className="space-y-1.5">
                    <Label className="text-xs capitalize">{p} — followers</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.socialStats?.[p]?.followerCount ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value)))
                        update('socialStats', {
                          ...(form.socialStats ?? {}),
                          [p]: { ...(form.socialStats?.[p] ?? {}), followerCount: v },
                        })
                      }}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs capitalize">{p} — engagement rate (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={form.socialStats?.[p]?.engagementRate ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value)))
                        update('socialStats', {
                          ...(form.socialStats ?? {}),
                          [p]: { ...(form.socialStats?.[p] ?? {}), engagementRate: v },
                        })
                      }}
                      placeholder="0.0"
                    />
                  </div>
                </div>
              ))}
            </section>

            {/* Rates */}
            <section className="space-y-3 border-t pt-5">
              <div>
                <h3 className="text-sm font-semibold">Your base rate</h3>
                <p className="text-xs text-muted-foreground">A starting point for negotiations. You can adjust per campaign.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Base rate per campaign</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.baseRate ?? ''}
                    onChange={(e) => update('baseRate', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select value={form.currency ?? 'INR'} onValueChange={(v) => update('currency', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INFLUENCER_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Content types */}
            <section className="space-y-3 border-t pt-5">
              <div>
                <h3 className="text-sm font-semibold">Content you offer</h3>
                <p className="text-xs text-muted-foreground">Pick all that apply.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {INFLUENCER_CONTENT_TYPES.map((t) => {
                  const selected = (form.contentTypes ?? []).includes(t)
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => {
                        const current = form.contentTypes ?? []
                        const next = selected
                          ? current.filter((x) => x !== t)
                          : [...current, t]
                        update('contentTypes', next)
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-pink-500 text-white border-pink-500'
                          : 'border-input hover:border-pink-400 hover:bg-pink-500/5'
                      }`}
                    >
                      {CONTENT_TYPE_LABELS[t]}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Audience demographics */}
            <section className="space-y-3 border-t pt-5">
              <div>
                <h3 className="text-sm font-semibold">Audience demographics</h3>
                <p className="text-xs text-muted-foreground">Helps brands match you to the right product. Percentages don&apos;t need to total 100 exactly.</p>
              </div>

              {/* Age brackets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Age brackets</Label>
                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${remainingTone(ageSum).cls}`}>
                    {remainingTone(ageSum).label}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AGE_BRACKET_KEYS.map((bracket) => (
                    <div key={bracket} className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{AGE_BRACKET_LABELS[bracket]}</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={form.audienceDemographics?.ageBrackets?.[bracket] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? undefined : Math.min(100, Math.max(0, Math.floor(Number(e.target.value))))
                            const next = { ...(form.audienceDemographics?.ageBrackets ?? {}) }
                            if (v === undefined) delete next[bracket]
                            else next[bracket] = v
                            update('audienceDemographics', {
                              ...(form.audienceDemographics ?? {}),
                              ageBrackets: next,
                            })
                          }}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Gender split</Label>
                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${remainingTone(genderSum).cls}`}>
                    {remainingTone(genderSum).label}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {GENDER_KEYS.map((g) => (
                    <div key={g} className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{GENDER_LABELS[g]}</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={form.audienceDemographics?.gender?.[g] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? undefined : Math.min(100, Math.max(0, Math.floor(Number(e.target.value))))
                            const next = { ...(form.audienceDemographics?.gender ?? {}) }
                            if (v === undefined) delete next[g]
                            else next[g] = v
                            update('audienceDemographics', {
                              ...(form.audienceDemographics ?? {}),
                              gender: next,
                            })
                          }}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top countries */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs">Top audience countries <span className="text-muted-foreground">(pick up to 5)</span></Label>
                <div className="flex flex-wrap gap-1.5">
                  {TOP_COUNTRY_OPTIONS.map((c) => {
                    const selected = (form.audienceDemographics?.topCountries ?? []).includes(c.code)
                    return (
                      <button
                        type="button"
                        key={c.code}
                        onClick={() => {
                          const current = form.audienceDemographics?.topCountries ?? []
                          const next = selected
                            ? current.filter((x) => x !== c.code)
                            : current.length < 5
                              ? [...current, c.code]
                              : current
                          update('audienceDemographics', {
                            ...(form.audienceDemographics ?? {}),
                            topCountries: next,
                          })
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-violet-500 text-white border-violet-500'
                            : 'border-input hover:border-violet-400 hover:bg-violet-500/5'
                        }`}
                      >
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={goToStep5} disabled={isPending} className="ml-auto">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save and continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Step 5 — Payout setup (skip-with-CTA per Q3) ──── */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-500" /> Payouts
            </CardTitle>
            <CardDescription>
              Where do brand payments land? You can add this later, but you&apos;ll need it before receiving payment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Set up a payout account</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bank account (India), UPI, PayPal, Wise, or SWIFT. Sensitive
                    fields are stored encrypted. One primary account per currency.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll save your wizard progress so you can come back and finish.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard/influencer/payouts" prefetch={false}>
                  <Wallet className="mr-2 h-4 w-4" /> Add payout account
                </Link>
              </Button>
              <Button onClick={completeOnboarding} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Skip for now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="flex pt-2">
              <Button variant="ghost" onClick={() => setStep(4)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Step 6 — Done ──────────────────────────────────── */}
      {step === 6 && (
        <Card>
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white">
              <Check className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl">
              You&apos;re all set, {userName || 'there'}! 🎉
            </CardTitle>
            <CardDescription className="text-base">
              Your influencer profile is live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Here&apos;s what to do next:
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Link
                href="/dashboard/influencer/marketplace"
                className="rounded-lg border border-border p-3 hover:border-violet-400 hover:bg-violet-500/5 transition-colors flex items-center gap-3"
              >
                <Megaphone className="h-5 w-5 text-violet-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Browse the marketplace</p>
                  <p className="text-xs text-muted-foreground">Apply to active brand campaigns</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link
                href="/dashboard/influencer/profile"
                className="rounded-lg border border-border p-3 hover:border-pink-400 hover:bg-pink-500/5 transition-colors flex items-center gap-3"
              >
                <User className="h-5 w-5 text-pink-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Improve your profile</p>
                  <p className="text-xs text-muted-foreground">Add portfolio links, verify handles</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link
                href="/dashboard/influencer/payouts"
                className="rounded-lg border border-border p-3 hover:border-emerald-400 hover:bg-emerald-500/5 transition-colors flex items-center gap-3"
              >
                <Wallet className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Set up your payout account</p>
                  <p className="text-xs text-muted-foreground">Required before your first paid campaign</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
            <Button onClick={goToDashboard} className="w-full" size="lg">
              Go to dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

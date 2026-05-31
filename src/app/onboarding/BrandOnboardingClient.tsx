'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { toast } from 'sonner'
import { Loader2, Upload, X, Building2, Mail, Receipt, Sparkles, ArrowRight, ArrowLeft, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ProgressIndicator } from '@/components/ProgressIndicator'
import { Badge } from '@/components/ui/badge'

import {
  saveCompanyBasicsAction,
  savePrimaryContactAction,
  saveBillingAction,
  completeBrandOnboardingAction,
} from './brand-onboarding.actions'

import {
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
} from '@/lib/validation/brand-onboarding'

import { CATEGORY_VALUES } from '@/lib/categories'

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'e4i_brand_onboarding_draft'
const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp'

const INDUSTRY_LABELS: Record<string, string> = {
  'fashion-apparel': 'Fashion & Apparel',
  'beauty-personal-care': 'Beauty & Personal Care',
  'food-beverage': 'Food & Beverage',
  'electronics-tech': 'Electronics & Tech',
  'home-furniture': 'Home & Furniture',
  'health-wellness': 'Health & Wellness',
  'sports-fitness': 'Sports & Fitness',
  'baby-kids': 'Baby & Kids',
  'pet-supplies': 'Pet Supplies',
  'automotive': 'Automotive',
  'travel-hospitality': 'Travel & Hospitality',
  'finance-fintech': 'Finance / Fintech',
  'education': 'Education',
  'saas-b2b': 'SaaS / B2B',
  'other': 'Other',
}

const REGION_OPTIONS = [
  'India',
  'Global',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Singapore',
  'UAE',
  'Southeast Asia',
  'Europe',
]

const PROGRESS_STEPS = [
  { id: 1, title: 'Welcome', description: 'Get started' },
  { id: 2, title: 'Company', description: 'Basics' },
  { id: 3, title: 'Contact', description: 'Primary contact' },
  { id: 4, title: 'Billing', description: 'Invoice details' },
  { id: 5, title: 'Audience', description: 'Logo & targeting' },
]

// ─── Draft persistence ───────────────────────────────────────────

interface DraftState {
  step?: number
  // Step 2
  companyName?: string
  industry?: string
  companySize?: string
  website?: string
  description?: string
  // Step 3
  primaryContactName?: string
  primaryContactRole?: string
  primaryContactPhone?: string
  // Step 4
  billingEntity?: string
  billingStreet?: string
  billingCity?: string
  billingState?: string
  billingPostalCode?: string
  billingCountry?: string
  billingGstin?: string
  // Step 5
  brandLogoUrl?: string
  targetCategories?: string[]
  targetRegions?: string[]
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

// ─── Main wizard ─────────────────────────────────────────────────

interface Props {
  // Hydrated from getBrandOnboardingState() in the server page so we
  // restore from the DB on cold reload (in addition to sessionStorage).
  initial: {
    companyName?: string
    industry?: string
    companySize?: string | null
    website?: string | null
    description?: string | null
    primaryContactName?: string | null
    primaryContactRole?: string | null
    primaryContactPhone?: string | null
    billingEntity?: string | null
    billingAddress?: {
      street?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    } | null
    billingGstin?: string | null
    brandLogoUrl?: string | null
    targetAudience?: {
      categories?: string[]
      regions?: string[]
    } | null
  } | null
  userName?: string | null
}

export default function BrandOnboardingClient({ initial, userName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)

  // Hydration-safe mount: read sessionStorage AFTER first paint.
  const [hydrated, setHydrated] = useState(false)

  // Combined state: DB-initial wins over sessionStorage draft on first
  // hydrate, then sessionStorage takes over as the user edits.
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<DraftState>({})

  useEffect(() => {
    const draft = loadDraft()
    setStep(Math.min(Math.max(draft.step ?? 1, 1), 5))
    setForm({
      companyName: initial?.companyName ?? draft.companyName ?? '',
      industry: initial?.industry ?? draft.industry ?? '',
      companySize: initial?.companySize ?? draft.companySize ?? '',
      website: initial?.website ?? draft.website ?? '',
      description: initial?.description ?? draft.description ?? '',
      primaryContactName:
        initial?.primaryContactName ?? draft.primaryContactName ?? userName ?? '',
      primaryContactRole: initial?.primaryContactRole ?? draft.primaryContactRole ?? '',
      primaryContactPhone: initial?.primaryContactPhone ?? draft.primaryContactPhone ?? '',
      billingEntity: initial?.billingEntity ?? draft.billingEntity ?? '',
      billingStreet: initial?.billingAddress?.street ?? draft.billingStreet ?? '',
      billingCity: initial?.billingAddress?.city ?? draft.billingCity ?? '',
      billingState: initial?.billingAddress?.state ?? draft.billingState ?? '',
      billingPostalCode:
        initial?.billingAddress?.postalCode ?? draft.billingPostalCode ?? '',
      billingCountry: initial?.billingAddress?.country ?? draft.billingCountry ?? '',
      billingGstin: initial?.billingGstin ?? draft.billingGstin ?? '',
      brandLogoUrl: initial?.brandLogoUrl ?? draft.brandLogoUrl ?? '',
      targetCategories:
        initial?.targetAudience?.categories ?? draft.targetCategories ?? [],
      targetRegions: initial?.targetAudience?.regions ?? draft.targetRegions ?? ['India'],
    })
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist on change
  useEffect(() => {
    if (!hydrated) return
    saveDraft({ ...form, step })
  }, [form, step, hydrated])

  const update = useCallback(<K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }, [])

  // ── Validation per step (mirrors server Zod schemas) ─────────
  const step2Valid =
    (form.companyName?.trim().length ?? 0) >= 2 && !!form.industry
  const step5Valid =
    (form.targetCategories?.length ?? 0) > 0 || (form.targetRegions?.length ?? 0) > 0

  // ── Logo upload (Vercel Blob client) ─────────────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const handleLogoUpload = async (file: File) => {
    setLogoError(null)
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError('Logo must be 2 MB or smaller')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError('Logo must be PNG, JPG, or WEBP')
      return
    }
    setLogoUploading(true)
    try {
      const blob = await upload(`brand-logos/${Date.now()}-${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/uploads/brand-logo',
      })
      update('brandLogoUrl', blob.url)
    } catch (err: any) {
      setLogoError(err?.message ?? 'Upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  // ── Step navigation handlers ─────────────────────────────────
  const goToStep2 = async () => {
    startTransition(async () => {
      const res = await saveCompanyBasicsAction({
        companyName: form.companyName ?? '',
        industry: form.industry ?? '',
        companySize: form.companySize || undefined,
        website: form.website || undefined,
        description: form.description || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setStep(3)
    })
  }

  const goToStep3 = async () => {
    startTransition(async () => {
      const res = await savePrimaryContactAction({
        primaryContactName: form.primaryContactName || undefined,
        primaryContactRole: form.primaryContactRole || undefined,
        primaryContactPhone: form.primaryContactPhone || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setStep(4)
    })
  }

  const goToStep4 = async () => {
    startTransition(async () => {
      const addr: Record<string, string> = {}
      if (form.billingStreet) addr.street = form.billingStreet
      if (form.billingCity) addr.city = form.billingCity
      if (form.billingState) addr.state = form.billingState
      if (form.billingPostalCode) addr.postalCode = form.billingPostalCode
      if (form.billingCountry) addr.country = form.billingCountry
      const res = await saveBillingAction({
        billingEntity: form.billingEntity || undefined,
        billingAddress: Object.keys(addr).length > 0 ? addr : null,
        billingGstin: form.billingGstin || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setStep(5)
    })
  }

  const finishOnboarding = async () => {
    startTransition(async () => {
      const res = await completeBrandOnboardingAction({
        brandLogoUrl: form.brandLogoUrl || undefined,
        targetAudience: {
          categories: form.targetCategories ?? [],
          regions: form.targetRegions ?? [],
        },
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      clearDraft()
      toast.success(`You're all set, ${form.companyName}! 🎉`)
      router.push('/dashboard?welcome=brand')
      router.refresh()
    })
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-8">
      <Card className="w-full max-w-3xl">
        {step > 1 && (
          <CardHeader>
            <ProgressIndicator currentStep={step} steps={PROGRESS_STEPS} />
          </CardHeader>
        )}

        <CardContent className={step === 1 ? 'pt-6' : ''}>
          {/* ───────── Step 1: Welcome ───────── */}
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Welcome to Earn4Insights
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Let&apos;s set up your brand account. Takes ~3 minutes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
                <div className="rounded-lg border border-border bg-card p-4">
                  <Building2 className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-medium">Company profile</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Industry, size, and brand story
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <Receipt className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-medium">Billing details</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    For invoices when you run campaigns
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <Sparkles className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-medium">Audience targeting</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Match the right consumers + influencers
                  </p>
                </div>
              </div>

              <Button onClick={() => setStep(2)} size="lg" className="mt-4">
                Get started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ───────── Step 2: Company basics ───────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <CardTitle className="text-2xl">Company basics</CardTitle>
                <CardDescription className="mt-1">
                  Tell us about your company. We&apos;ll use this on your
                  brand profile, campaign pages, and marketplace listings.
                </CardDescription>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">
                    Company name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    value={form.companyName ?? ''}
                    onChange={(e) => update('companyName', e.target.value)}
                    placeholder="Acme Inc."
                    maxLength={100}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Industry <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.industry ?? ''}
                    onValueChange={(v) => update('industry', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick an industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {INDUSTRY_LABELS[opt] ?? opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Company size</Label>
                  <RadioGroup
                    value={form.companySize ?? ''}
                    onValueChange={(v) => update('companySize', v)}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                  >
                    {COMPANY_SIZE_OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        htmlFor={`size-${opt}`}
                        className={`
                          flex items-center justify-center rounded-md border px-3 py-2 text-sm cursor-pointer
                          transition-colors
                          ${
                            form.companySize === opt
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-input bg-background text-muted-foreground hover:border-primary/40'
                          }
                        `}
                      >
                        <RadioGroupItem id={`size-${opt}`} value={opt} className="sr-only" />
                        {opt}
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={form.website ?? ''}
                    onChange={(e) => update('website', e.target.value)}
                    placeholder="https://acme.com"
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    Short description
                    <span className="text-xs text-muted-foreground ml-2">
                      {(form.description?.length ?? 0)}/500
                    </span>
                  </Label>
                  <Textarea
                    id="description"
                    value={form.description ?? ''}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="What does your brand do? A sentence or two."
                    rows={3}
                    maxLength={500}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)} disabled={isPending}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={goToStep2} disabled={!step2Valid || isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ───────── Step 3: Primary contact ───────── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <CardTitle className="text-2xl">Primary contact</CardTitle>
                <CardDescription className="mt-1">
                  Who should we reach out to about campaigns, payments,
                  and account questions?
                </CardDescription>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact name</Label>
                  <Input
                    id="contactName"
                    value={form.primaryContactName ?? ''}
                    onChange={(e) => update('primaryContactName', e.target.value)}
                    placeholder="Jane Doe"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactRole">Role at company</Label>
                  <Input
                    id="contactRole"
                    value={form.primaryContactRole ?? ''}
                    onChange={(e) => update('primaryContactRole', e.target.value)}
                    placeholder="CEO, Head of Marketing, etc."
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone (optional)</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={form.primaryContactPhone ?? ''}
                    onChange={(e) => update('primaryContactPhone', e.target.value)}
                    placeholder="+91 98765 43210"
                    maxLength={20}
                  />
                </div>

                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex gap-2">
                  <Mail className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    All optional, but a phone number helps us reach you
                    fast for time-sensitive campaign issues.
                  </span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={isPending}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={goToStep3} disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ───────── Step 4: Billing ───────── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <CardTitle className="text-2xl">Billing details</CardTitle>
                <CardDescription className="mt-1">
                  Used for invoices when you pay for campaigns. You can
                  skip this for now and fill it in later from settings.
                </CardDescription>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="billingEntity">Billing entity (legal name)</Label>
                  <Input
                    id="billingEntity"
                    value={form.billingEntity ?? ''}
                    onChange={(e) => update('billingEntity', e.target.value)}
                    placeholder="Acme Private Limited"
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingStreet">Street address</Label>
                  <Input
                    id="billingStreet"
                    value={form.billingStreet ?? ''}
                    onChange={(e) => update('billingStreet', e.target.value)}
                    placeholder="123 Main St"
                    maxLength={200}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="billingCity">City</Label>
                    <Input
                      id="billingCity"
                      value={form.billingCity ?? ''}
                      onChange={(e) => update('billingCity', e.target.value)}
                      placeholder="Bengaluru"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingState">State / Region</Label>
                    <Input
                      id="billingState"
                      value={form.billingState ?? ''}
                      onChange={(e) => update('billingState', e.target.value)}
                      placeholder="Karnataka"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingPostal">Postal code</Label>
                    <Input
                      id="billingPostal"
                      value={form.billingPostalCode ?? ''}
                      onChange={(e) => update('billingPostalCode', e.target.value)}
                      placeholder="560001"
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingCountry">Country</Label>
                    <Input
                      id="billingCountry"
                      value={form.billingCountry ?? ''}
                      onChange={(e) => update('billingCountry', e.target.value)}
                      placeholder="India"
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingGstin">
                    GSTIN
                    <span className="text-xs text-muted-foreground ml-2">
                      (Optional, for Indian businesses)
                    </span>
                  </Label>
                  <Input
                    id="billingGstin"
                    value={form.billingGstin ?? ''}
                    onChange={(e) => update('billingGstin', e.target.value.toUpperCase())}
                    placeholder="27ABCDE1234F1Z5"
                    maxLength={15}
                  />
                  {(form.billingGstin?.length ?? 0) > 0 &&
                    (form.billingGstin?.length ?? 0) !== 15 && (
                      <p className="text-xs text-amber-500">
                        GSTIN is 15 characters. Double-check the value.
                      </p>
                    )}
                </div>
              </div>

              <div className="flex justify-between pt-2 gap-2">
                <Button variant="ghost" onClick={() => setStep(3)} disabled={isPending}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={goToStep4} disabled={isPending}>
                    Skip for now
                  </Button>
                  <Button onClick={goToStep4} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ───────── Step 5: Logo + audience ───────── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <CardTitle className="text-2xl">Brand assets &amp; audience</CardTitle>
                <CardDescription className="mt-1">
                  Final step! Upload your logo and tell us who you want
                  to reach. Helps us match relevant consumers and
                  influencers to your campaigns.
                </CardDescription>
              </div>

              {/* Logo upload */}
              <div className="space-y-2">
                <Label>Brand logo</Label>
                <div className="rounded-md border border-dashed border-border bg-muted/20 p-4">
                  {form.brandLogoUrl ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={form.brandLogoUrl}
                        alt="Brand logo preview"
                        className="h-16 w-16 rounded object-contain border border-border bg-background"
                      />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground break-all">
                          Uploaded
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => update('brandLogoUrl', '')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        PNG, JPG, or WEBP &middot; max 2 MB
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={LOGO_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handleLogoUpload(f)
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={logoUploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {logoUploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {logoUploading ? 'Uploading…' : 'Choose file'}
                      </Button>
                    </div>
                  )}
                  {logoError && (
                    <p className="text-xs text-destructive mt-2 text-center">
                      {logoError}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Optional — you can add or change this later in settings.
                </p>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <Label>Target product categories</Label>
                <p className="text-xs text-muted-foreground">
                  Pick the categories your products fit into. Used for
                  ICP matching.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORY_VALUES.map((cat) => {
                    const selected = form.targetCategories?.includes(cat)
                    return (
                      <label
                        key={cat}
                        className={`
                          flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm
                          transition-colors
                          ${
                            selected
                              ? 'border-primary bg-primary/10'
                              : 'border-input bg-background hover:border-primary/40'
                          }
                        `}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(c) => {
                            const cur = form.targetCategories ?? []
                            update(
                              'targetCategories',
                              c
                                ? Array.from(new Set([...cur, cat]))
                                : cur.filter((x) => x !== cat),
                            )
                          }}
                        />
                        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                          {cat}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Regions */}
              <div className="space-y-2">
                <Label>Target regions</Label>
                <div className="flex flex-wrap gap-2">
                  {REGION_OPTIONS.map((r) => {
                    const selected = form.targetRegions?.includes(r)
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          const cur = form.targetRegions ?? []
                          update(
                            'targetRegions',
                            selected
                              ? cur.filter((x) => x !== r)
                              : Array.from(new Set([...cur, r])),
                          )
                        }}
                        className={`
                          rounded-full border px-3 py-1 text-xs transition-colors
                          ${
                            selected
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-input bg-background text-muted-foreground hover:border-primary/40'
                          }
                        `}
                      >
                        {selected && <Check className="inline h-3 w-3 mr-1" />}
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>

              {!step5Valid && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600">
                  Pick at least one category or region so we can match
                  the right audience to your campaigns.
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(4)} disabled={isPending}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={finishOnboarding} disabled={!step5Valid || isPending} size="lg">
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Complete setup
                </Button>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-center text-muted-foreground">
                  After this, you can: add your first product, create an
                  ICP, launch a survey, or run an influencer campaign.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Convenience exports (used by the dashboard banner status badge) ──
export const __wizardStepCount = PROGRESS_STEPS.length

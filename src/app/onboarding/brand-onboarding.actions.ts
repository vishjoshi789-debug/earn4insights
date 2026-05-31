'use server'

import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { auditLog } from '@/db/schema'
import {
  getBrandProfile,
  upsertBrandProfile,
  markBrandOnboardingComplete,
} from '@/db/repositories/brandProfileRepository'
import {
  companyBasicsSchema,
  primaryContactSchema,
  billingSchema,
  brandAssetsSchema,
  completeBrandOnboardingSchema,
  type CompanyBasicsInput,
  type PrimaryContactInput,
  type BillingInput,
  type BrandAssetsInput,
} from '@/lib/validation/brand-onboarding'

/**
 * Brand onboarding server actions — invoked from the wizard UI.
 * Next.js server actions carry their own framework-level CSRF guard
 * (origin-checked POST to /api/__nextjs_..._action), so we don't add
 * application-level CSRF on top.
 *
 * Auth: every action re-verifies the session + brand role. We do NOT
 * trust any role hint baked into the form payload — the user id and
 * role come from the session, never the client.
 *
 * Return shape: { ok: true } on success, { ok: false, error: '...' }
 * on validation/auth failure. The wizard surfaces error to the user.
 */

interface ActionOk<T = undefined> {
  ok: true
  data?: T
}
interface ActionErr {
  ok: false
  error: string
  fieldErrors?: Record<string, string>
}
type ActionResult<T = undefined> = ActionOk<T> | ActionErr

async function requireBrand(): Promise<{ userId: string } | ActionErr> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.email) {
    return { ok: false, error: 'Not signed in' }
  }
  if ((session.user as any).role !== 'brand') {
    return { ok: false, error: 'Brand account required' }
  }
  return { userId: (session.user as any).id }
}

function flattenZodErrors(error: { issues: Array<{ path: (string | number)[]; message: string }> }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    if (!out[key]) out[key] = issue.message
  }
  return out
}

// ── Step 2: Company basics ──────────────────────────────────────
export async function saveCompanyBasicsAction(
  raw: unknown,
): Promise<ActionResult> {
  const guard = await requireBrand()
  if ('ok' in guard) return guard

  const parsed = companyBasicsSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Validation failed', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const data: CompanyBasicsInput = parsed.data
  await upsertBrandProfile(guard.userId, {
    companyName: data.companyName,
    industry: data.industry,
    companySize: data.companySize || null,
    website: data.website || null,
    description: data.description || null,
  })

  return { ok: true }
}

// ── Step 3: Primary contact ─────────────────────────────────────
export async function savePrimaryContactAction(
  raw: unknown,
): Promise<ActionResult> {
  const guard = await requireBrand()
  if ('ok' in guard) return guard

  const parsed = primaryContactSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Validation failed', fieldErrors: flattenZodErrors(parsed.error) }
  }

  // Refuse if step 2 wasn't completed yet — row must exist with
  // companyName + industry before partial updates make sense.
  const existing = await getBrandProfile(guard.userId)
  if (!existing) {
    return { ok: false, error: 'Complete step 2 (company basics) first' }
  }

  const data: PrimaryContactInput = parsed.data
  await upsertBrandProfile(guard.userId, {
    primaryContactName: data.primaryContactName || null,
    primaryContactRole: data.primaryContactRole || null,
    primaryContactPhone: data.primaryContactPhone || null,
  })

  return { ok: true }
}

// ── Step 4: Billing ─────────────────────────────────────────────
export async function saveBillingAction(
  raw: unknown,
): Promise<ActionResult> {
  const guard = await requireBrand()
  if ('ok' in guard) return guard

  const parsed = billingSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Validation failed', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const existing = await getBrandProfile(guard.userId)
  if (!existing) {
    return { ok: false, error: 'Complete step 2 (company basics) first' }
  }

  const data: BillingInput = parsed.data
  // Strip empty-string address subfields so we don't store {street: ''} blobs.
  const cleanedAddress = data.billingAddress
    ? Object.fromEntries(
        Object.entries(data.billingAddress).filter(([, v]) => typeof v === 'string' && v !== '')
      )
    : null
  await upsertBrandProfile(guard.userId, {
    billingEntity: data.billingEntity || null,
    billingAddress: cleanedAddress && Object.keys(cleanedAddress).length > 0 ? cleanedAddress : null,
    billingGstin: data.billingGstin || null,
  })

  return { ok: true }
}

// ── Step 5: Brand assets + complete ─────────────────────────────
export async function completeBrandOnboardingAction(
  raw: unknown,
): Promise<ActionResult> {
  const guard = await requireBrand()
  if ('ok' in guard) return guard

  // Step 5 carries assets-only fields; we merge with the existing row's
  // required fields via completeBrandOnboardingSchema for safety. If
  // the brand jumped here without step 2, this will fail validation.
  const existing = await getBrandProfile(guard.userId)
  if (!existing) {
    return { ok: false, error: 'Complete the earlier steps first' }
  }

  const merged = {
    companyName: existing.companyName,
    industry: existing.industry,
    companySize: existing.companySize ?? '',
    website: existing.website ?? '',
    description: existing.description ?? '',
    primaryContactName: existing.primaryContactName ?? '',
    primaryContactRole: existing.primaryContactRole ?? '',
    primaryContactPhone: existing.primaryContactPhone ?? '',
    billingEntity: existing.billingEntity ?? '',
    billingAddress: existing.billingAddress ?? null,
    billingGstin: existing.billingGstin ?? '',
    // Step-5 values from the raw payload — overlay onto existing.
    ...((raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {}),
  }

  const parsed = completeBrandOnboardingSchema.safeParse(merged)
  if (!parsed.success) {
    return { ok: false, error: 'Validation failed', fieldErrors: flattenZodErrors(parsed.error) }
  }

  // Persist step-5 fields specifically (logo + target audience).
  const stepFive: BrandAssetsInput = brandAssetsSchema.parse({
    brandLogoUrl: parsed.data.brandLogoUrl,
    targetAudience: parsed.data.targetAudience,
  })
  await upsertBrandProfile(guard.userId, {
    brandLogoUrl: stepFive.brandLogoUrl || null,
    targetAudience: stepFive.targetAudience ?? null,
  })

  // Flip the onboarding-complete flag + audit log.
  const completed = await markBrandOnboardingComplete(guard.userId)
  if (!completed) {
    return { ok: false, error: 'Failed to mark onboarding complete' }
  }

  // Audit log — financial / compliance-relevant moment (this is when
  // the brand becomes invoiceable + visible in marketplace).
  await db.insert(auditLog).values({
    userId: guard.userId,
    action: 'brand_onboarding_completed',
    dataType: 'brand_profile',
    accessedBy: guard.userId,
    metadata: {
      companyName: existing.companyName,
      industry: existing.industry,
      hasBillingEntity: !!completed.billingEntity,
      hasGstin: !!completed.billingGstin,
      hasLogo: !!completed.brandLogoUrl,
      hasTargetAudience: !!completed.targetAudience,
    },
    reason: 'Brand finished the onboarding wizard',
  })

  return { ok: true }
}

/**
 * Read-only fetch the wizard uses on mount to hydrate from any saved
 * partial state. Returns null when no row exists (fresh brand).
 */
export async function getBrandOnboardingState() {
  const guard = await requireBrand()
  if ('ok' in guard) return { ok: false as const, error: guard.error }
  const profile = await getBrandProfile(guard.userId)
  return { ok: true as const, profile }
}

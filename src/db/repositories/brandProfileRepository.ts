import 'server-only'

import { db } from '@/db'
import { brandProfiles, type BrandProfile, type NewBrandProfile } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Lookup a brand profile by the owning user id. Returns null if no row
 * exists — that's a brand who hasn't started onboarding yet.
 */
export async function getBrandProfile(userId: string): Promise<BrandProfile | null> {
  const [row] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.userId, userId))
    .limit(1)
  return row ?? null
}

/**
 * Has the brand finished onboarding? Used by OnboardingGuard and the
 * dashboard banner. A NULL row counts as "not completed".
 */
export async function hasCompletedBrandOnboarding(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ done: brandProfiles.onboardingCompleted })
    .from(brandProfiles)
    .where(eq(brandProfiles.userId, userId))
    .limit(1)
  return row?.done === true
}

/**
 * Upsert pattern for incremental wizard saves. Each step calls this
 * with the fields it controls + the userId. The first call creates the
 * row (companyName + industry MUST be present in the payload since
 * they are NOT NULL on the table — the wizard enforces this on step 2).
 * Subsequent calls patch the row without re-supplying the required cols.
 *
 * Throws when called for the FIRST time without companyName + industry
 * (e.g. a malformed step-3-first attempt). The wizard prevents this
 * by gating step navigation on step-2 validity.
 */
export async function upsertBrandProfile(
  userId: string,
  patch: Partial<Omit<NewBrandProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<BrandProfile> {
  const existing = await getBrandProfile(userId)

  if (existing) {
    const [updated] = await db
      .update(brandProfiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(brandProfiles.userId, userId))
      .returning()
    return updated
  }

  if (!patch.companyName || !patch.industry) {
    throw new Error(
      'Brand profile not yet created — first save must include companyName + industry',
    )
  }

  const [inserted] = await db
    .insert(brandProfiles)
    .values({
      userId,
      companyName: patch.companyName,
      industry: patch.industry,
      companySize: patch.companySize ?? null,
      website: patch.website ?? null,
      description: patch.description ?? null,
      primaryContactName: patch.primaryContactName ?? null,
      primaryContactRole: patch.primaryContactRole ?? null,
      primaryContactPhone: patch.primaryContactPhone ?? null,
      billingEntity: patch.billingEntity ?? null,
      billingAddress: patch.billingAddress ?? null,
      billingGstin: patch.billingGstin ?? null,
      brandLogoUrl: patch.brandLogoUrl ?? null,
      targetAudience: patch.targetAudience ?? null,
      onboardingCompleted: patch.onboardingCompleted ?? false,
      onboardingCompletedAt: patch.onboardingCompletedAt ?? null,
    })
    .returning()
  return inserted
}

/**
 * Atomically mark onboarding complete + stamp the timestamp. Returns
 * the updated row or null if the row doesn't exist (caller decides
 * how to handle — typically the wizard should have created the row
 * via the step-2 save already).
 */
export async function markBrandOnboardingComplete(userId: string): Promise<BrandProfile | null> {
  const [updated] = await db
    .update(brandProfiles)
    .set({
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(brandProfiles.userId, userId))
    .returning()
  return updated ?? null
}

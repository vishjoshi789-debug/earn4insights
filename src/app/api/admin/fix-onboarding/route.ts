import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * One-shot operational fix: force-complete onboarding for a specific user.
 *
 * POST /api/admin/fix-onboarding
 * Header: x-api-key: <ADMIN_API_KEY>
 * Body: { email: "user@example.com" }
 *
 * Idempotent. Use sparingly — for users whose onboarding_complete flag
 * was wiped by an earlier destructive reconciliation pass and who keep
 * getting redirected to /onboarding despite having actually completed it.
 *
 * Sets:
 *   onboarding_complete = true
 *   demographics = {} (empty object so the legacy fallback in
 *                     hasCompletedOnboarding() — which inspects
 *                     demographics fields — has something to read)
 *   updated_at    = NOW()
 *
 * Returns: { updated, profile: { id, email, onboardingComplete, ... } }
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { email?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  try {
    const before = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.email, email))
      .limit(1)

    if (before.length === 0) {
      return NextResponse.json({ error: 'No profile found for that email' }, { status: 404 })
    }

    const existing = before[0]
    // Sensible defaults — only fill demographics if it was null. We don't
    // know the user's actual answers; we just need ANY non-null shape so
    // the fallback completion check stops returning false.
    const demographics = (existing.demographics as Record<string, unknown> | null) ?? {
      __fixed: true,
    }

    await db
      .update(userProfiles)
      .set({
        onboardingComplete: true,
        demographics,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.email, email))

    const after = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.email, email))
      .limit(1)

    console.log(
      `[fix-onboarding] email=${email} ` +
      `wasComplete=${existing.onboardingComplete} → true; ` +
      `id=${existing.id}`
    )

    return NextResponse.json({
      ok: true,
      updated: 1,
      previous: {
        onboardingComplete: existing.onboardingComplete,
        hasDemographics: !!existing.demographics,
      },
      profile: {
        id: after[0]?.id,
        email: after[0]?.email,
        onboardingComplete: after[0]?.onboardingComplete,
        hasDemographics: !!after[0]?.demographics,
        hasInterests: !!after[0]?.interests,
      },
    })
  } catch (err) {
    console.error('[fix-onboarding] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

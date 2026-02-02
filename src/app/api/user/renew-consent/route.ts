import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Renew User Consent
 * 
 * GDPR requires periodic consent renewal (recommended every 12 months).
 * This endpoint updates user consent preferences and records the renewal timestamp.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Parse request body
    const body = await request.json()
    const { consents } = body

    if (!consents || typeof consents !== 'object') {
      return NextResponse.json(
        { error: 'Invalid consent data' },
        { status: 400 }
      )
    }

    console.log(`[ConsentRenewal] User ${userId} renewing consent...`)

    // Get current profile
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, userId)
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Update consent with renewal timestamp
    const updatedConsent = {
      ...(profile.consent || {}),
      ...consents,
      grantedAt: new Date().toISOString(),
      renewedAt: new Date().toISOString(),
      version: ((profile.consent as any)?.version || 0) + 1,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    }

    // Update the profile
    await db
      .update(userProfiles)
      .set({
        consent: updatedConsent,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.id, userId))

    console.log(`[ConsentRenewal] ✓ User ${userId} consent renewed (version ${updatedConsent.version})`)

    return NextResponse.json({
      success: true,
      message: 'Consent renewed successfully',
      consent: updatedConsent
    })

  } catch (error) {
    console.error('[ConsentRenewal] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to renew consent',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

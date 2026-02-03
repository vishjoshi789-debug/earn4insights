import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { userProfiles, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logAccountDeletion } from '@/lib/audit-log'
/**
 * GDPR Account Deletion Endpoint
 * 
 * Allows users to request account deletion (Right to be Forgotten)
 * Required by GDPR Article 17
 * 
 * Process:
 * 1. POST /api/user/delete-account → Marks account for deletion (30-day grace period)
 * 2. User receives confirmation email
 * 3. After 30 days, cron job permanently deletes data
 * 4. User can cancel deletion within 30 days via /api/user/cancel-deletion
 */

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { reason } = await request.json().catch(() => ({ reason: null }))

    console.log(`[GDPR Deletion] User ${userId} requested account deletion`)

    // Update profile to mark for deletion
    const deletionScheduledFor = new Date()
    deletionScheduledFor.setDate(deletionScheduledFor.getDate() + 30) // 30-day grace period

    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    if (profile[0]) {
      await db
        .update(userProfiles)
        .set({
          // Store deletion request in consent field
          consent: {
            ...(profile[0].consent as any || {}),
            deletionRequested: true,
            deletionRequestedAt: new Date().toISOString(),
            deletionScheduledFor: deletionScheduledFor.toISOString(),
            deletionReason: reason
          },
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, userId))
    }

    // TODO: Send confirmation email with cancellation link

    // Log deletion request for audit trail (GDPR compliance)
    await logAccountDeletion(
      userId,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      request.headers.get('user-agent') || undefined,
      reason
    )

    console.log(`[GDPR Deletion] Account marked for deletion on ${deletionScheduledFor.toISOString()}`)

    return NextResponse.json({
      success: true,
      message: 'Account deletion scheduled',
      deletionScheduledFor: deletionScheduledFor.toISOString(),
      gracePeriodDays: 30,
      canCancelUntil: deletionScheduledFor.toISOString(),
      cancellationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/user/cancel-deletion`
    })

  } catch (error) {
    console.error('[GDPR Deletion] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process deletion request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Cancel scheduled account deletion
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    console.log(`[GDPR Deletion] User ${userId} cancelled account deletion`)

    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    if (profile[0]) {
      const consent = profile[0].consent as any
      
      await db
        .update(userProfiles)
        .set({
          consent: {
            ...consent,
            deletionRequested: false,
            deletionCancelledAt: new Date().toISOString()
          },
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, userId))
    }

    return NextResponse.json({
      success: true,
      message: 'Account deletion cancelled',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[GDPR Deletion] Error cancelling:', error)
    return NextResponse.json(
      { 
        error: 'Failed to cancel deletion',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Email verification status check (Phase EV.1).
 * GET /api/auth/check-verification
 *
 * Used by client-side polling: when a user clicks the verification
 * link in a different tab / their email app, the originating tab can
 * poll this endpoint to detect the transition and update UI without
 * a full reload.
 *
 * Auth: logged-in user only.
 * No rate limit needed — GET, idempotent, cheap single-row lookup.
 *
 * Returns:
 *   { verified: boolean, verifiedAt: ISO string | null }
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getEmailVerifiedAt } from '@/server/emailVerificationService'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id as string

  const verifiedAt = await getEmailVerifiedAt(userId)
  return NextResponse.json({
    verified: verifiedAt !== null,
    verifiedAt: verifiedAt ? verifiedAt.toISOString() : null,
  })
}

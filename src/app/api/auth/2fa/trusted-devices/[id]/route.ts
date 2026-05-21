import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { removeTrustedDevice } from '@/server/twoFactorService'

/**
 * DELETE /api/auth/2fa/trusted-devices/[id]
 *
 * Remove one trusted device. Scoped to the owner — deleting another
 * user's device returns 404 (no existence leak).
 *
 * Auth: required · CSRF: required
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const { id } = await params
  const removed = await removeTrustedDevice(userId, id)
  if (!removed) {
    return NextResponse.json({ error: 'Device not found.' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}

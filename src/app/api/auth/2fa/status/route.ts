import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getTwoFactorStatus } from '@/server/twoFactorService'

/**
 * GET /api/auth/2fa/status
 *
 * Current 2FA state for the settings UI: whether it's enabled, whether
 * the account can use it (password accounts only), and recovery-code
 * count. Auth: required.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const status = await getTwoFactorStatus(userId)
  return NextResponse.json(status)
}

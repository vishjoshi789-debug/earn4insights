import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { listTrustedDevices } from '@/server/twoFactorService'
import { TRUSTED_DEVICE_COOKIE } from '@/lib/twoFactor/devices'

/**
 * GET /api/auth/2fa/trusted-devices
 *
 * List the caller's trusted devices. The device the request came from
 * is flagged `isCurrent`.
 *
 * Auth: required
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const deviceCookie = req.cookies.get(TRUSTED_DEVICE_COOKIE)?.value ?? null
  const devices = await listTrustedDevices(userId, deviceCookie)
  return NextResponse.json({ devices })
}

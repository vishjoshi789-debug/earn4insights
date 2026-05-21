import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { twoFactorManageRateLimit } from '@/lib/rate-limit-upstash'
import { generateSetup, TwoFactorError } from '@/server/twoFactorService'

/**
 * POST /api/auth/2fa/setup
 *
 * Begin 2FA setup — returns a QR code (data URL) and the base32 secret
 * for manual entry. Does NOT enable 2FA; the user must confirm a code
 * via /api/auth/2fa/verify-setup.
 *
 * Auth: required · CSRF: required
 */
export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const rl = await twoFactorManageRateLimit.limit(userId)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  try {
    const { qrCodeDataUrl, secret } = await generateSetup(userId)
    return NextResponse.json({ qrCodeDataUrl, secret })
  } catch (err) {
    if (err instanceof TwoFactorError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.code === 'already_enabled' ? 409 : 400 },
      )
    }
    console.error('[2fa/setup]', err)
    return NextResponse.json({ error: 'Failed to start 2FA setup.' }, { status: 500 })
  }
}

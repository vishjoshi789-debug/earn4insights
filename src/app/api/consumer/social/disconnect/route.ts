/**
 * Consumer Social Disconnect
 * DELETE /api/consumer/social/disconnect
 *
 * Revokes a connected social platform account.
 * Sets revokedAt on the connection and nullifies the encrypted token.
 * The connection row is preserved for audit trail.
 *
 * Body: { platform: 'instagram' | 'twitter' | 'linkedin' | 'youtube' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { revokeSocialConnection } from '@/db/repositories/socialConnectionRepository'
import type { SocialPlatform } from '@/db/repositories/socialConnectionRepository'

const VALID_PLATFORMS: SocialPlatform[] = ['instagram', 'twitter', 'linkedin', 'youtube']

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role

    if (!userId || role !== 'consumer') {
      return NextResponse.json({ error: 'Consumer access only' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body?.platform || !VALID_PLATFORMS.includes(body.platform)) {
      return NextResponse.json(
        { error: `Missing or invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` },
        { status: 400 }
      )
    }

    await revokeSocialConnection(userId, body.platform as SocialPlatform)

    return NextResponse.json({
      success: true,
      platform: body.platform,
      revokedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Social Disconnect DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

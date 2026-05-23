/**
 * Consumer Social Connections — List
 * GET /api/consumer/social/connections
 *
 * Returns all active (non-revoked) social connections for the authenticated consumer.
 * Token fields are stripped from the response — only metadata is returned.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getActiveSocialConnections } from '@/db/repositories/socialConnectionRepository'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role

    // Admins manage their own social connections from the same settings
    // page consumers use, so admin role is allowed alongside consumer.
    // Brands have no connections of their own — keep them out.
    if (!userId || (role !== 'consumer' && role !== 'admin')) {
      return NextResponse.json({ error: 'Consumer or admin access only' }, { status: 403 })
    }

    const connections = await getActiveSocialConnections(userId)

    // Strip encrypted token fields from response
    const safe = connections.map(({ encryptedAccessToken, encryptionKeyId, ...rest }) => rest)

    return NextResponse.json({ connections: safe })
  } catch (error) {
    console.error('[Social Connections GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

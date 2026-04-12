/**
 * Brand Application Response API
 * POST /api/brand/applications/[id]/respond — Accept or reject application
 * Auth: brand (must own the campaign)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { respondToApplication } from '@/server/campaignMarketplaceService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'brand') return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    const userId = (session.user as any).id
    const { id } = await params

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { status, response } = body
    if (!status || !['accepted', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'status must be accepted or rejected' }, { status: 400 })
    }

    const application = await respondToApplication(userId, id, status, response || null)
    return NextResponse.json({ application })
  } catch (error: any) {
    console.error('[Brand Respond POST]', error)
    const msg = error.message || 'Internal server error'
    const code = msg.includes('not found') || msg.includes('Not your') ? 403 : 500
    return NextResponse.json({ error: msg }, { status: code })
  }
}

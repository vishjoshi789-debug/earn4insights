/**
 * POST /api/deals/[id]/save
 *
 * Toggle save/unsave a deal. Auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { toggleSaveDeal } from '@/server/dealsService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const { id } = await params
    const result = await toggleSaveDeal(id, userId)
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Deal not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[DealSave POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

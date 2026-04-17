/**
 * POST /api/admin/payouts/process  — Mark a payout as processing
 * POST /api/admin/payouts/complete — Mark a payout as completed
 *
 * Both actions are on this route, differentiated by `action` in the body.
 *
 * Body for process:  { payoutId, action: 'process', note? }
 * Body for complete: { payoutId, action: 'complete', transferReference?, note? }
 * Body for fail:     { payoutId, action: 'fail', reason }
 *
 * Auth: admin role only
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  markPayoutProcessing,
  markPayoutCompleted,
  markPayoutFailed,
  retryFailedPayout,
} from '@/server/payoutService'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = session.user as any
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }
    const adminId: string = user.id

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { payoutId, action, note, transferReference, reason } = body

    if (!payoutId || typeof payoutId !== 'string') {
      return NextResponse.json({ error: 'payoutId is required' }, { status: 400 })
    }
    if (!action || !['process', 'complete', 'fail', 'retry'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be process, complete, fail, or retry' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'process':
        await markPayoutProcessing(payoutId, adminId, note)
        return NextResponse.json({ success: true, status: 'processing' })

      case 'complete':
        await markPayoutCompleted(payoutId, adminId, transferReference, note)
        return NextResponse.json({ success: true, status: 'completed' })

      case 'fail':
        if (!reason || typeof reason !== 'string') {
          return NextResponse.json({ error: 'reason is required for fail action' }, { status: 400 })
        }
        await markPayoutFailed(payoutId, adminId, reason)
        return NextResponse.json({ success: true, status: 'failed' })

      case 'retry': {
        const retryResult = await retryFailedPayout(payoutId, adminId)
        return NextResponse.json({ success: true, newStatus: retryResult.newStatus })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof Error) {
      // Surface service-level validation errors to admin
      if (
        error.message.includes('exceeded max retries') ||
        error.message.includes('Can only') ||
        error.message.includes('not found')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    console.error('[AdminPayoutsProcess POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

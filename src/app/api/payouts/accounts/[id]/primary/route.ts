/**
 * POST /api/payouts/accounts/[id]/primary
 *
 * Set a payout account as the primary account for its currency.
 * Unsets any other primary account for the same user + currency.
 *
 * Auth: session + owns account
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getAccountById, setPrimaryAccount } from '@/db/repositories/payoutAccountRepository'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId: string = (session.user as any).id
    const { id } = await params

    // Verify ownership
    const account = await getAccountById(id, userId)
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await setPrimaryAccount(id, userId)

    return NextResponse.json({ success: true, id, currency: account.currency })
  } catch (error) {
    console.error('[PayoutAccount Primary POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

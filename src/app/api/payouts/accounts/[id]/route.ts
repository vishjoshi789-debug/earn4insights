/**
 * PUT    /api/payouts/accounts/[id] — Update a payout account
 * DELETE /api/payouts/accounts/[id] — Soft delete a payout account
 *
 * Auth: session + owns account
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { encryptForStorage } from '@/lib/encryption'
import {
  getAccountById,
  updatePayoutAccount,
  deletePayoutAccount,
} from '@/db/repositories/payoutAccountRepository'

type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    // Build update payload — only fields allowed to change
    const updates: any = {}

    if (body.accountHolderName !== undefined) updates.accountHolderName = body.accountHolderName
    if (body.ifscCode !== undefined) updates.ifscCode = body.ifscCode
    if (body.upiId !== undefined) updates.upiId = body.upiId
    if (body.paypalEmail !== undefined) updates.paypalEmail = body.paypalEmail
    if (body.wiseEmail !== undefined) updates.wiseEmail = body.wiseEmail
    if (body.swiftCode !== undefined) updates.swiftCode = body.swiftCode
    if (body.bankName !== undefined) updates.bankName = body.bankName
    if (body.bankCountry !== undefined) updates.bankCountry = body.bankCountry

    // Re-encrypt if sensitive fields are being updated
    if (body.accountNumber !== undefined) {
      const encrypted = await encryptForStorage(body.accountNumber)
      updates.accountNumber = encrypted.encryptedValue
      updates.encryptionKeyId = encrypted.encryptionKeyId
    }
    if (body.iban !== undefined) {
      const encrypted = await encryptForStorage(body.iban)
      updates.iban = encrypted.encryptedValue
      updates.encryptionKeyId = encrypted.encryptionKeyId
    }

    const updated = await updatePayoutAccount(id, userId, updates)

    return NextResponse.json({ success: true, id: updated.id })
  } catch (error) {
    console.error('[PayoutAccount PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
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

    // Block deletion of primary account — user must set another as primary first
    if (account.isPrimary) {
      return NextResponse.json(
        { error: 'Cannot delete primary account. Set another account as primary first.' },
        { status: 400 }
      )
    }

    await deletePayoutAccount(id, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PayoutAccount DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

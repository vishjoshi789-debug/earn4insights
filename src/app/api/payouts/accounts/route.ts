/**
 * GET  /api/payouts/accounts — List current user's payout accounts
 * POST /api/payouts/accounts — Add a new payout account
 *
 * Auth: any authenticated role (influencer, consumer, brand)
 *
 * POST encrypts account_number and IBAN before storing.
 * Max 5 active accounts per user.
 * Validates format per account type.
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { encryptForStorage, decryptFromStorage } from '@/lib/encryption'
import {
  getPayoutAccounts,
  createPayoutAccount,
} from '@/db/repositories/payoutAccountRepository'

/**
 * Decrypt an encrypted value and return only the last 4 characters masked.
 * Returns null if the value is empty or decryption fails.
 */
async function decryptAndMask(
  encryptedValue: string | null,
  encryptionKeyId: string | null
): Promise<string | null> {
  if (!encryptedValue || !encryptionKeyId) return null
  try {
    const plaintext = await decryptFromStorage(encryptedValue, encryptionKeyId)
    if (plaintext.length <= 4) return '••••'
    return '••••' + plaintext.slice(-4)
  } catch {
    return '••••****'
  }
}

// ── Format validators ─────────────────────────────────────────────

function validateAccountFormat(accountType: string, body: any): string | null {
  switch (accountType) {
    case 'upi':
      if (!body.upiId || !String(body.upiId).includes('@')) {
        return 'UPI ID must be in format username@provider (e.g. name@upi)'
      }
      break
    case 'bank_account':
      if (!body.accountNumber) return 'Account number is required'
      if (!body.ifscCode) return 'IFSC code is required'
      if (String(body.ifscCode).length !== 11) return 'IFSC code must be exactly 11 characters'
      if (!body.accountHolderName) return 'Account holder name is required'
      break
    case 'paypal':
      if (!body.paypalEmail || !String(body.paypalEmail).includes('@')) {
        return 'Valid PayPal email is required'
      }
      break
    case 'wise':
      if (!body.wiseEmail || !String(body.wiseEmail).includes('@')) {
        return 'Valid Wise email is required'
      }
      break
    case 'swift':
      if (!body.swiftCode) return 'SWIFT code is required'
      const swiftLen = String(body.swiftCode).length
      if (swiftLen !== 8 && swiftLen !== 11) return 'SWIFT code must be 8 or 11 characters'
      if (!body.bankName) return 'Bank name is required'
      if (!body.bankCountry) return 'Bank country is required'
      break
    default:
      return 'accountType must be bank_account, upi, paypal, wise, or swift'
  }
  return null
}

// ── GET ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId: string = (session.user as any).id

    const accounts = await getPayoutAccounts(userId)

    // Mask sensitive fields — decrypt then show only last 4 digits
    const safeAccounts = await Promise.all(
      accounts.map(async (acc) => ({
        id: acc.id,
        accountType: acc.accountType,
        userRole: acc.userRole,
        currency: acc.currency,
        isPrimary: acc.isPrimary,
        isVerified: acc.isVerified,
        // Masked display fields — decrypt first, then mask
        accountHolderName: acc.accountHolderName,
        accountNumberMasked: await decryptAndMask(acc.accountNumber, acc.encryptionKeyId),
        ifscCode: acc.ifscCode,
        upiId: acc.upiId,
        paypalEmail: acc.paypalEmail,
        wiseEmail: acc.wiseEmail,
        swiftCode: acc.swiftCode,
        ibanMasked: await decryptAndMask(acc.iban, acc.encryptionKeyId),
        bankName: acc.bankName,
        bankCountry: acc.bankCountry,
        createdAt: acc.createdAt,
      }))
    )

    return NextResponse.json({ accounts: safeAccounts })
  } catch (error) {
    console.error('[PayoutAccounts GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = session.user as any
    const userId: string = user.id
    const userRole: string = user.role === 'brand' ? 'influencer' : user.role // brands shouldn't be adding payout accounts

    // ── Parse body ────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { accountType, currency = 'INR', isPrimary = false } = body
    if (!accountType) return NextResponse.json({ error: 'accountType is required' }, { status: 400 })

    // ── Validate format ───────────────────────────────────────────
    const validationError = validateAccountFormat(accountType, body)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    // ── Max 5 accounts per user ────────────────────────────────────
    const existing = await getPayoutAccounts(userId)
    if (existing.length >= 5) {
      return NextResponse.json(
        { error: 'Maximum 5 payout accounts allowed. Delete an existing account to add a new one.' },
        { status: 400 }
      )
    }

    // ── Encrypt sensitive fields ───────────────────────────────────
    let accountNumber: string | null = null
    let encryptionKeyId: string | null = null
    let iban: string | null = null

    if (body.accountNumber) {
      const encrypted = await encryptForStorage(body.accountNumber)
      accountNumber = encrypted.encryptedValue
      encryptionKeyId = encrypted.encryptionKeyId
    }

    if (body.iban) {
      const encrypted = await encryptForStorage(body.iban)
      iban = encrypted.encryptedValue
      // Use same key ID (both encrypted at same time with same key)
      encryptionKeyId = encrypted.encryptionKeyId
    }

    // ── Create account ─────────────────────────────────────────────
    const account = await createPayoutAccount({
      userId,
      userRole: userRole as 'influencer' | 'consumer',
      accountType: accountType as any,
      currency,
      isPrimary,
      isVerified: false,
      isActive: true,
      accountHolderName: body.accountHolderName ?? null,
      accountNumber,
      ifscCode: body.ifscCode ?? null,
      upiId: body.upiId ?? null,
      paypalEmail: body.paypalEmail ?? null,
      wiseEmail: body.wiseEmail ?? null,
      swiftCode: body.swiftCode ?? null,
      iban,
      bankName: body.bankName ?? null,
      bankCountry: body.bankCountry ?? null,
      encryptionKeyId,
    })

    return NextResponse.json({
      id: account.id,
      accountType: account.accountType,
      currency: account.currency,
      isPrimary: account.isPrimary,
      createdAt: account.createdAt,
    }, { status: 201 })
  } catch (error: any) {
    // Unique constraint: same type+currency already exists
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'You already have an active account of this type and currency' },
        { status: 409 }
      )
    }
    console.error('[PayoutAccounts POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

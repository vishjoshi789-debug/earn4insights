import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 008: Payment System
 * POST /api/admin/run-migration-008
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates 4 new tables:
 *   - influencer_payout_accounts (payout accounts for influencers + consumers)
 *   - razorpay_orders (Razorpay payment order tracking)
 *   - influencer_payouts (outgoing payouts to recipients)
 *   - payment_redemptions (consumer point redemptions)
 *
 * ALTERs campaign_payments with 3 new columns.
 *
 * Prerequisites: migrations 001–007 must be applied first.
 * Idempotent: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── 1. CREATE influencer_payout_accounts ──────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS influencer_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL DEFAULT 'influencer',
  account_type TEXT NOT NULL,
  account_holder_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  paypal_email TEXT,
  wise_email TEXT,
  swift_code TEXT,
  iban TEXT,
  bank_name TEXT,
  bank_country TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP,
  encryption_key_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
)`)
    results.push({ name: 'influencer_payout_accounts', status: 'ok' })

    // Partial unique: one active account per user+type+currency
    await pgClient.unsafe(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_accounts_user_type_currency
  ON influencer_payout_accounts (user_id, account_type, currency)
  WHERE is_active = true`)
    results.push({ name: 'idx_payout_accounts_user_type_currency', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_payout_accounts_user_primary
  ON influencer_payout_accounts (user_id, is_primary)`)
    results.push({ name: 'idx_payout_accounts_user_primary', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_payout_accounts_user_active
  ON influencer_payout_accounts (user_id, is_active)`)
    results.push({ name: 'idx_payout_accounts_user_active', status: 'ok' })

    // ── 2. CREATE razorpay_orders ─────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS razorpay_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES influencer_campaigns(id),
  milestone_id UUID REFERENCES campaign_milestones(id),
  brand_id TEXT NOT NULL REFERENCES users(id),
  razorpay_order_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  platform_fee INTEGER NOT NULL DEFAULT 0,
  influencer_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'created',
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  payment_method TEXT,
  international BOOLEAN NOT NULL DEFAULT false,
  refund_amount INTEGER DEFAULT 0,
  refund_id TEXT,
  refunded_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
)`)
    results.push({ name: 'razorpay_orders', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_campaign
  ON razorpay_orders (campaign_id)`)
    results.push({ name: 'idx_razorpay_orders_campaign', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_brand_status
  ON razorpay_orders (brand_id, status)`)
    results.push({ name: 'idx_razorpay_orders_brand_status', status: 'ok' })

    // ── 3. CREATE influencer_payouts ──────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS influencer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES influencer_campaigns(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  recipient_type TEXT NOT NULL DEFAULT 'influencer',
  payout_account_id UUID NOT NULL REFERENCES influencer_payout_accounts(id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payout_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  razorpay_payout_id TEXT,
  wise_transfer_id TEXT,
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  initiated_at TIMESTAMP,
  completed_at TIMESTAMP,
  admin_note TEXT,
  processed_by TEXT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
)`)
    results.push({ name: 'influencer_payouts', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_payouts_recipient_status
  ON influencer_payouts (recipient_id, status)`)
    results.push({ name: 'idx_payouts_recipient_status', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_payouts_pending
  ON influencer_payouts (status)
  WHERE status = 'pending'`)
    results.push({ name: 'idx_payouts_pending', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_payouts_campaign
  ON influencer_payouts (campaign_id)`)
    results.push({ name: 'idx_payouts_campaign', status: 'ok' })

    // ── 4. CREATE payment_redemptions ──────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS payment_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  value INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  redemption_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payout_id UUID REFERENCES influencer_payouts(id),
  voucher_code TEXT,
  brand_id TEXT REFERENCES users(id),
  failure_reason TEXT,
  processed_at TIMESTAMP,
  admin_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
)`)
    results.push({ name: 'payment_redemptions', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_redemptions_consumer_status
  ON payment_redemptions (consumer_id, status)`)
    results.push({ name: 'idx_redemptions_consumer_status', status: 'ok' })

    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_redemptions_pending
  ON payment_redemptions (status)
  WHERE status = 'pending'`)
    results.push({ name: 'idx_redemptions_pending', status: 'ok' })

    // ── 5. ALTER campaign_payments — add 3 columns ────────────────────
    const paymentColumns = [
      'platform_fee_percent NUMERIC(4,2)',
      'influencer_amount INTEGER',
      "international BOOLEAN DEFAULT false",
    ]
    for (const col of paymentColumns) {
      const colName = col.split(' ')[0]
      try {
        await pgClient.unsafe(`ALTER TABLE campaign_payments ADD COLUMN IF NOT EXISTS ${col}`)
      } catch (e: any) {
        if (e?.code === '42701') { /* column already exists */ } else throw e
      }
      results.push({ name: `campaign_payments.${colName}`, status: 'ok' })
    }

    return NextResponse.json({
      success: true,
      message: 'Migration 008 applied successfully — Payment System',
      results,
    })
  } catch (error) {
    console.error('[Migration 008] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Migration 008 failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
        results,
      },
      { status: 500 },
    )
  }
}

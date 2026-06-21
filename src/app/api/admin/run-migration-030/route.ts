import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 030: status/enum CHECK constraints (Tier B — B34 Phase 1b).
 * POST /api/admin/run-migration-030
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Additive CHECK constraints on status/enum text columns. Values taken from
 * the schema.ts $type<> unions (campaign_payments) / documented enum comment
 * (reward_redemptions). All three tables are empty in prod at apply time
 * (pre-launch), so zero violation risk — the constraints exist to reject any
 * out-of-enum value the app might write post-launch.
 *
 * Adds:
 *   - chk_campaign_payments_status         pending/escrowed/released/refunded/failed
 *   - chk_campaign_payments_payment_type   escrow/milestone/direct
 *   - chk_reward_redemptions_status        pending/fulfilled/cancelled
 *
 * NOTE: reward_redemptions.status is a plain text column (enum only in a code
 * comment, not a $type union) — if the redemption service ever writes a value
 * outside this set, update this CHECK in a follow-up migration.
 *
 * Idempotent: DO-block guards on pg_constraint.conname; safe to re-run.
 * No BEGIN/COMMIT (pooled pgClient blocks transaction control).
 * Pattern parallel: migration 029.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── campaign_payments.status ──────────────────────────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaign_payments_status'
        ) THEN
          ALTER TABLE campaign_payments
            ADD CONSTRAINT chk_campaign_payments_status
            CHECK (status IN ('pending', 'escrowed', 'released', 'refunded', 'failed'));
        END IF;
      END $$
    `)
    results.push({ name: 'chk_campaign_payments_status', status: 'ensured' })

    // ── campaign_payments.payment_type ────────────────────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaign_payments_payment_type'
        ) THEN
          ALTER TABLE campaign_payments
            ADD CONSTRAINT chk_campaign_payments_payment_type
            CHECK (payment_type IN ('escrow', 'milestone', 'direct'));
        END IF;
      END $$
    `)
    results.push({ name: 'chk_campaign_payments_payment_type', status: 'ensured' })

    // ── reward_redemptions.status ─────────────────────────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_reward_redemptions_status'
        ) THEN
          ALTER TABLE reward_redemptions
            ADD CONSTRAINT chk_reward_redemptions_status
            CHECK (status IN ('pending', 'fulfilled', 'cancelled'));
        END IF;
      END $$
    `)
    results.push({ name: 'chk_reward_redemptions_status', status: 'ensured' })

    return NextResponse.json({
      success: true,
      message: 'Migration 030 completed: 3 status/enum CHECK constraints (B34 Phase 1b)',
      results,
    })
  } catch (error) {
    console.error('[Migration 030] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 030 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 },
    )
  }
}

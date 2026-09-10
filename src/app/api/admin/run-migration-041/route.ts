import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 041: payout_requests gets a real paid state and a payment
 * reference.
 *
 * ⚠️⚠️ ORDERING IS NOT OPTIONAL — RUN THIS BEFORE THE DEPLOY.
 *
 * `/api/payouts` does `db.select().from(payoutRequests)` in TWO places (the
 * consumer branch of GET, and the fetch inside PATCH). Drizzle expands a bare
 * select to every column in the schema, so the moment schema.ts declares
 * `payment_reference` and `paid_at` those queries ask Postgres for columns that
 * do not exist yet and throw — taking down the consumer payout page and the
 * admin approval path together.
 *
 * Standard sequence (same as 033 and 034, zero downtime both times):
 *   1. Paste the additive SQL below into the Neon console FIRST
 *   2. Deploy
 *   3. Run this route as an idempotent confirming no-op
 *
 * ── WHY ──────────────────────────────────────────────────────────
 *
 * `payout_requests.status` was pending | approved | denied. There was no state
 * meaning "the money actually left", and nowhere to record the bank or UPI
 * transaction reference — so 'approved' had to carry both "an admin said yes"
 * and "the consumer was paid", with the reference stuffed into a free-text
 * `note` if anyone remembered.
 *
 * On a money path that is not good enough. "Did this person get paid, and what
 * is the bank reference?" must be answerable from structured columns, not from
 * prose someone may or may not have typed.
 *
 * The lifecycle is now explicit and mirrors influencer_payouts
 * (pending -> processing -> completed):
 *
 *   pending  -> approved  admin authorised it; money has NOT moved
 *            -> paid      money sent; payment_reference + paid_at recorded
 *            -> denied    rejected; points refunded by the PATCH handler
 *
 * ⚠️ 'approved' deliberately survives as a distinct state rather than being
 * collapsed into 'paid'. An admin authorising a payout and an admin completing
 * a bank transfer are different acts, often minutes or days apart, and
 * collapsing them would make the queue claim money had moved the instant
 * someone clicked approve — which is the class of false record this whole wave
 * has been removing.
 *
 * ── ALSO ADDS THE CHECK THAT WAS NEVER THERE ─────────────────────
 *
 * Migrations 029 and 030 added status CHECKs to campaign_payments and
 * reward_redemptions. payout_requests was missed — its status column accepted
 * any string at all. Added now, pinning the four valid values.
 *
 * ⚠️ The CHECK is added AFTER a normalising UPDATE, because any pre-existing
 * out-of-vocabulary status would make the ALTER fail. Production held only
 * 'pending' rows at the time of writing, so that UPDATE should report 0.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── 1. The two new columns. Nullable, no default ───────────────
    // A default on either would assert something false about every existing
    // row: that it carries a reference, or that it was paid at a known time.
    await pgClient.unsafe(`
      ALTER TABLE payout_requests
        ADD COLUMN IF NOT EXISTS payment_reference text;
    `)
    results.push({ name: 'payout_requests.payment_reference', status: 'ensured' })

    await pgClient.unsafe(`
      ALTER TABLE payout_requests
        ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;
    `)
    results.push({ name: 'payout_requests.paid_at', status: 'ensured' })

    // ── 2. Normalise before constraining ──────────────────────────
    const normalised = await pgClient.unsafe(`
      UPDATE payout_requests
         SET status = 'pending'
       WHERE status NOT IN ('pending', 'approved', 'paid', 'denied')
      RETURNING id, status;
    `)
    results.push({
      name: 'out-of-vocabulary statuses normalised',
      status: `updated ${normalised.length}`,
    })

    // ── 3. The CHECK 029/030 never added for this table ───────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_payout_requests_status'
        ) THEN
          ALTER TABLE payout_requests
            ADD CONSTRAINT chk_payout_requests_status
            CHECK (status IN ('pending', 'approved', 'paid', 'denied'));
        END IF;
      END $$;
    `)
    results.push({ name: 'chk_payout_requests_status', status: 'ensured' })

    // ── 4. Partial index for the admin queue ──────────────────────
    // The queue reads unfinished requests; the finished ones grow without
    // bound and are never in that view.
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_payout_requests_open
        ON payout_requests (requested_at DESC)
        WHERE status IN ('pending', 'approved');
    `)
    results.push({ name: 'idx_payout_requests_open', status: 'ensured' })

    // ── Coverage ──────────────────────────────────────────────────
    const [coverage] = await pgClient.unsafe(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE status = 'pending')::int  AS pending,
             count(*) FILTER (WHERE status = 'approved')::int AS approved,
             count(*) FILTER (WHERE status = 'paid')::int     AS paid,
             count(*) FILTER (WHERE status = 'denied')::int   AS denied,
             count(*) FILTER (WHERE payment_reference IS NOT NULL)::int AS with_reference
      FROM payout_requests;
    `)

    return NextResponse.json({
      ok: true,
      message: 'Migration 041 completed: payout_requests paid state + payment reference',
      results,
      coverage,
      detail:
        'payment_reference and paid_at are nullable with no default — an existing row must not claim it was paid. ' +
        'Status vocabulary is now pinned: pending | approved | paid | denied.',
    })
  } catch (error: any) {
    console.error('[Migration041]', error)
    return NextResponse.json({ ok: false, error: error.message, results }, { status: 500 })
  }
}

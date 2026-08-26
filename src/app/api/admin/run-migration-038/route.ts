import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 038: link a payout to the payment that funded it.
 *
 * WHY
 * ---
 * `process-payouts` decided which released payments still needed a payout with:
 *
 *   NOT EXISTS (SELECT 1 FROM influencer_payouts
 *               WHERE influencer_payouts.campaign_id = campaign_payments.campaign_id)
 *
 * That correlates on the CAMPAIGN, so once any payout exists for a campaign,
 * every later released payment on it is skipped forever. For a campaign paid
 * per milestone, only the FIRST milestone is ever paid out — the creator is
 * silently underpaid and nothing reports it.
 *
 * It was not a sloppy predicate: `influencer_payouts` had no column referencing
 * `campaign_payments`, so the campaign was the only thing available to
 * correlate on. This migration adds the missing link.
 *
 * Beyond the bug, this is the row-level trace from ledger to payout that any
 * future reconciliation needs — "which payment funded this payout" currently
 * has no answer.
 *
 * ⚠️ Column is NULLABLE and deliberately stays that way. `influencer_payouts`
 * also carries reward/consumer payouts that have no `campaign_payments` row at
 * all (`campaign_id` is itself nullable for exactly that reason), so NOT NULL
 * would break a legitimate existing case.
 *
 * ⚠️⚠️ THE BACKFILL IS LOAD-BEARING — IT IS NOT TIDY-UP.
 *
 * An earlier draft of this migration shipped with NO backfill, reasoning that
 * inferring a historical link means guessing. That reasoning was incomplete and
 * the omission was a DEFECT, because of how the new dedup reads:
 *
 *   NOT EXISTS (SELECT 1 FROM influencer_payouts
 *               WHERE campaign_payment_id = campaign_payments.id)
 *
 * A pre-038 payout has campaign_payment_id NULL, so it matches NOTHING. Its
 * already-paid payment therefore looks unpaid, and the next cron tick creates a
 * SECOND payout for it. The old campaign-keyed predicate blocked that; the new
 * one cannot. Leaving these rows unlinked does not strand them — it RE-PAYS
 * them.
 *
 * So the backfill exists to prevent duplicate payouts, and it is SELF-LIMITING
 * rather than clever: it links a payout to a payment only where a campaign has
 * EXACTLY ONE released payment and EXACTLY ONE payout. In that shape the link
 * is determined, not guessed. Anything ambiguous is deliberately left NULL and
 * counted in the coverage line, so it surfaces as a known unknown rather than a
 * confident wrong answer — the same discipline migration 033 used when a naive
 * email join claimed "23/23 backfillable" and the honest number was 5.
 *
 * ⚠️ Rows left NULL by this backfill are STILL exposed to the duplicate-payout
 * path above. They need a human decision (link, delete, or mark), which is why
 * the coverage line reports them separately instead of burying them in a total.
 *
 * Amounts are NOT used as a matching criterion: `influencer_amount` is NULL on
 * rows written by the deleted escrowForMilestone, so requiring a match would
 * link nothing. A mismatch is reported instead, as a signal the link is wrong.
 *
 * ON DELETE SET NULL, matching migration 033's reasoning for feedback.user_id:
 * losing the payment record must not destroy the record that money was sent.
 *
 * Ordering: SAFE EITHER WAY. Adding a nullable column breaks no existing
 * SELECT, and the code that writes it tolerates the column being absent only
 * insofar as it is deployed together — but since nothing reads it until the
 * new dedup query ships, applying this before or after the deploy is
 * equivalent. Unlike a `feedback` column, `influencer_payouts` has no bare
 * `db.select().from()` callers that would break on a schema/DB mismatch.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── The column ────────────────────────────────────────────────
    await pgClient.unsafe(`
      ALTER TABLE influencer_payouts
        ADD COLUMN IF NOT EXISTS campaign_payment_id UUID;
    `)
    results.push({ name: 'influencer_payouts.campaign_payment_id', status: 'ensured' })

    // ── FK → campaign_payments (SET NULL, not CASCADE) ────────────
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_influencer_payouts_campaign_payment'
        ) THEN
          ALTER TABLE influencer_payouts
            ADD CONSTRAINT fk_influencer_payouts_campaign_payment
            FOREIGN KEY (campaign_payment_id)
            REFERENCES campaign_payments(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    `)
    results.push({ name: 'fk_influencer_payouts_campaign_payment', status: 'ensured' })

    // ── Index ─────────────────────────────────────────────────────
    // The new dedup runs NOT EXISTS on this column for every released
    // payment, on every cron tick. Partial (WHERE NOT NULL) because reward
    // payouts legitimately leave it NULL and never need to be found by it.
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_influencer_payouts_campaign_payment
        ON influencer_payouts (campaign_payment_id)
        WHERE campaign_payment_id IS NOT NULL;
    `)
    results.push({ name: 'idx_influencer_payouts_campaign_payment', status: 'ensured' })

    // ── Self-limiting backfill ────────────────────────────────────
    // Only campaigns with exactly one released payment AND exactly one payout.
    // Idempotent via the `campaign_payment_id IS NULL` guard, so re-running
    // never re-links or overwrites.
    const linked = await pgClient.unsafe(`
      WITH counts AS (
        SELECT c.campaign_id,
               (SELECT count(*) FROM campaign_payments cp
                  WHERE cp.campaign_id = c.campaign_id AND cp.status = 'released') AS released_count,
               (SELECT count(*) FROM influencer_payouts po
                  WHERE po.campaign_id = c.campaign_id) AS payout_count
        FROM (
          SELECT DISTINCT campaign_id FROM influencer_payouts WHERE campaign_id IS NOT NULL
        ) c
      ),
      unambiguous AS (
        SELECT counts.campaign_id,
               (SELECT cp.id FROM campaign_payments cp
                  WHERE cp.campaign_id = counts.campaign_id AND cp.status = 'released'
                  LIMIT 1) AS payment_id
        FROM counts
        WHERE counts.released_count = 1 AND counts.payout_count = 1
      )
      UPDATE influencer_payouts po
         SET campaign_payment_id = u.payment_id,
             updated_at = now()
        FROM unambiguous u
       WHERE po.campaign_id = u.campaign_id
         AND po.campaign_payment_id IS NULL
         AND u.payment_id IS NOT NULL
      RETURNING po.id;
    `)
    results.push({
      name: 'backfill campaign_payment_id (1:1 campaigns only)',
      status: `linked ${linked.length}`,
    })

    // ── Coverage line ─────────────────────────────────────────────
    // Prints what the state actually is rather than asserting success, in the
    // house style of 033/034/035/037. `unlinked` counts campaign payouts with
    // no ledger link — expected to be every pre-038 row, and it should stay
    // flat afterwards rather than growing.
    const [state] = await pgClient.unsafe(`
      SELECT
        (SELECT count(*) FROM influencer_payouts)                               AS payouts_total,
        (SELECT count(*) FROM influencer_payouts WHERE campaign_id IS NOT NULL) AS campaign_payouts,
        (SELECT count(*) FROM influencer_payouts
           WHERE campaign_id IS NOT NULL AND campaign_payment_id IS NOT NULL)   AS linked,
        (SELECT count(*) FROM influencer_payouts
           WHERE campaign_id IS NOT NULL AND campaign_payment_id IS NULL)       AS still_unlinked,
        (SELECT count(*) FROM campaign_payments WHERE status = 'released')      AS released_payments,
        -- Released payments with no payout pointing at them: exactly what the
        -- cron will act on next tick. Any row here that was ALREADY paid via an
        -- unlinked legacy payout is a pending duplicate.
        (SELECT count(*) FROM campaign_payments cp
           WHERE cp.status = 'released'
             AND NOT EXISTS (SELECT 1 FROM influencer_payouts po
                               WHERE po.campaign_payment_id = cp.id))           AS cron_will_pay,
        -- Linked rows whose amount disagrees with the payment's influencer
        -- amount. Non-zero means a link is probably wrong; NULL amounts are
        -- excluded because escrowForMilestone never set influencer_amount.
        (SELECT count(*) FROM influencer_payouts po
           JOIN campaign_payments cp ON cp.id = po.campaign_payment_id
          WHERE cp.influencer_amount IS NOT NULL
            AND po.amount <> cp.influencer_amount)                              AS amount_mismatches
    `)

    return NextResponse.json({
      ok: true,
      message: 'Migration 038 completed: payout → payment link',
      results,
      state,
      detail:
        `payouts=${state.payouts_total} campaign_payouts=${state.campaign_payouts} ` +
        `linked=${state.linked} still_unlinked=${state.still_unlinked} ` +
        `released_payments=${state.released_payments} cron_will_pay=${state.cron_will_pay} ` +
        `amount_mismatches=${state.amount_mismatches}`,
      // Read this before running the payout cron. still_unlinked rows are the
      // ones that could be paid twice; cron_will_pay is what the next tick
      // actually acts on.
      warning:
        Number(state.still_unlinked) > 0
          ? `${state.still_unlinked} campaign payout(s) remain unlinked (ambiguous — more than one released payment or more than one payout on the campaign). Each is exposed to a DUPLICATE PAYOUT on the next process-payouts run. Resolve by hand before running the cron.`
          : null,
    })
  } catch (error: any) {
    console.error('[Migration038]', error)
    return NextResponse.json(
      { ok: false, error: error.message, results },
      { status: 500 },
    )
  }
}

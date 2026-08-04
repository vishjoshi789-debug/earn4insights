/**
 * Backfill: repair `feedback.status = 'approved'` rows.
 *
 * BACKGROUND
 * ----------
 * `approved` is not a member of VALID_STATUSES (`new | reviewed | addressed`).
 * `STATUS_CONFIG` in FeedbackStatusButton has no such key, so it falls back to
 * `new` — meaning these rows displayed as "new" forever and a brand could not
 * move them through the review workflow. The PATCH status route also rejects
 * `approved`, so no app code could ever set it back.
 *
 * All three ingestion paths hardcoded it (`api/import/csv`,
 * `api/import/webhook`, `api/import/webhook/v2`). **Those are fixed first** —
 * backfilling before fixing the source would just let it recur, at volume,
 * mixed in with real data.
 *
 * WHAT THIS DOES
 *   status 'approved' -> 'new'
 *
 * 'new' because imported feedback has not been reviewed by the brand — it
 * belongs at the front of the workflow, and it matches what the UI was already
 * (accidentally) displaying, so nothing visibly changes for the brand.
 *
 * Idempotent: only touches rows still holding 'approved'.
 *
 * Run:
 *   dotenv -e .env.local -- tsx scripts/backfill-feedback-approved-status.ts --dry-run
 *   dotenv -e .env.local -- tsx scripts/backfill-feedback-approved-status.ts
 */

import { db } from '@/db'
import { feedback } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

const DRY_RUN = process.argv.includes('--dry-run')

async function run() {
  const before = await db
    .select({ status: feedback.status, n: sql<number>`count(*)::int` })
    .from(feedback)
    .groupBy(feedback.status)

  console.log(`\n=== feedback.status backfill ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE)'} ===`)
  console.log('before:')
  for (const r of before) console.log(`   ${String(r.status).padEnd(12)} ${r.n}`)

  const target = before.find((r) => r.status === 'approved')
  if (!target) {
    console.log('\nNothing to do — no rows with status=\'approved\'.\n')
    return
  }

  console.log(`\n  'approved' -> 'new'  (${target.n} row(s))`)

  if (!DRY_RUN) {
    await db.update(feedback).set({ status: 'new' }).where(eq(feedback.status, 'approved'))

    const after = await db
      .select({ status: feedback.status, n: sql<number>`count(*)::int` })
      .from(feedback)
      .groupBy(feedback.status)
    console.log('\nafter:')
    for (const r of after) console.log(`   ${String(r.status).padEnd(12)} ${r.n}`)
  }
  console.log()
}

run()
  .catch((err) => {
    console.error('Fatal:', err)
    process.exitCode = 1
  })
  .finally(() => process.exit(process.exitCode ?? 0))

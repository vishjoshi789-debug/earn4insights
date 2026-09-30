/**
 * DELIBERATELY-FAILING PROBE — does `db.transaction()` ROLL BACK on the
 * pgBouncer pooler?
 *
 * ── 🔴 WHAT IS ACTUALLY AT STAKE ──────────────────────────────────────────
 *
 * This is NOT only a gate on `approveClaim`. **If rollback is broken on the
 * pooler, `deductPoints` is not atomic — and that is LIVE IN PRODUCTION MOVING
 * REAL POINTS.**
 *
 * `pointsService.ts:217` runs the balance update, the `point_transactions`
 * record and the audit log inside one `db.transaction()`. If a throw partway
 * through does not undo the earlier writes, the failure mode is:
 *
 *   → the consumer's balance is decremented
 *   → no `point_transactions` row explains where the points went
 *   → the user sees a 500 and a smaller balance
 *   → there is nothing to reconcile against or refund from
 *
 * That is the exact silent loss the transaction was added to prevent
 * (`3b47eea`). The same applies to `claimProduct` (ownership moves,
 * `brand_id` re-key does not) and to the redemption path.
 *
 * 🔴 **And there is a SECOND live production dependency on rollback, which is
 * load-bearing against overselling.** `api/rewards/route.ts:116` deliberately
 * throws `ROLLBACK_OUT_OF_STOCK` **in order to undo a points deduction** when
 * the stock decrement finds nothing left:
 *
 *   deduct points → decrement stock → if stock was already 0, THROW to undo
 *
 * If rollback does not work, that consumer is charged points for a reward that
 * was out of stock, and the route returns a 400 telling them it failed. The
 * throw is not error handling there — it IS the concurrency control.
 *
 * So a broken result here is not a blocked feature — it is a live money defect
 * across every "atomic" write in the codebase. Treat it accordingly.
 *
 * ── WHY IT EXISTS AT ALL ──────────────────────────────────────────────────
 * COMMIT is proven by data: the 2026-08-23 row in `payment_redemptions` is the
 * output of the `db.transaction()` at `api/consumer/rewards/redeem/route.ts:154`,
 * on production, through the pooler.
 *
 * **But commit and rollback are different behaviours, and pgBouncer in
 * transaction mode can break the second while the first looks fine.** Proving
 * commit and assuming rollback is the "verified the middle of the path" error
 * this project keeps repeating.
 *
 * ── 🔒 IT MUST RUN AGAINST THE POOLED ENDPOINT ────────────────────────────
 * A DIRECT Postgres connection ALWAYS honours rollback, so pointing this at the
 * direct endpoint makes it pass trivially and prove nothing. It therefore
 * REFUSES any host whose name does not contain `-pooler`, and prints the host
 * before it writes anything so a wrong target can be aborted.
 *
 * It also REFUSES to run unless `DATABASE_URL_OVERRIDE` is set explicitly, and
 * never falls back to `POSTGRES_URL` / `DATABASE_URL`, because `.env.local`
 * points at the PRODUCTION database (CLAUDE.md §11). A write-probe with a
 * fallback is how a probe ends up writing to prod.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────
 * 1. Opens a real `db.transaction()` using the app's own client options.
 * 2. INSERTs a marked row into `cron_runs`.
 * 3. THROWS inside the transaction.
 * 4. Outside, queries for that row by id.
 *      absent  → rollback WORKS
 *      present → rollback BROKEN; the row is deleted and the probe fails loud
 *
 * `cron_runs` is the target on purpose: nothing FKs into it, a stray row has no
 * business meaning, and `job_name` makes the row trivially identifiable.
 * ⚠️ The marker is `__rollback_probe_*`, never `social/cron`, so it cannot
 * pollute the separate `cron_runs` watch for the social/cron delete decision.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────
 *   $env:DATABASE_URL_OVERRIDE = '<PREVIEW branch POOLED url — must contain -pooler>'
 *   npx tsx scripts/probe-transaction-rollback.ts
 *
 * Delete this file once the answer is recorded.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { cronRuns } from '../src/db/schema'

/**
 * ── THE THREE INCONCLUSIVE OUTCOMES, AND WHAT TO DO ABOUT EACH ────────────
 *
 * A probe that can say "I don't know" without defining when is a probe that can
 * leave you where you started. These are the only three, each printed with its
 * own code and next step:
 *
 *  INCONCLUSIVE-A — the throw did NOT propagate out of `db.transaction()`.
 *    Meaning: the driver swallowed the error; the wrapper is not behaving as a
 *    transaction at all. Rollback status genuinely unknown.
 *    Next: check `drizzle-orm` / `postgres` versions against the lockfile, then
 *    re-run. Do NOT build on rollback.
 *
 *  INCONCLUSIVE-B — an unexpected error type was thrown.
 *    Meaning: the probe never reached the test — connection refused, auth
 *    failure, `cron_runs` missing on that branch, SSL problem. Says NOTHING
 *    about rollback either way.
 *    Next: read the printed error, fix the connection or run migration 037 on
 *    that branch, re-run.
 *
 *  INCONCLUSIVE-C — no row id was captured from the INSERT.
 *    Meaning: the insert returned no row, so there was nothing to look for
 *    afterwards. Usually a `cron_runs` shape change or a silently rejected
 *    insert.
 *    Next: verify `cron_runs` columns match `schema.ts` on that branch, re-run.
 *
 * Any INCONCLUSIVE result leaves the original question open and `approveClaim`
 * must stay unbuilt. Only "ROLLBACK WORKS" clears it.
 */

const url = process.env.DATABASE_URL_OVERRIDE
if (!url) {
  console.error(
    '\n🔒 REFUSING TO RUN: DATABASE_URL_OVERRIDE is not set.\n\n' +
    'This probe WRITES. It deliberately does not fall back to POSTGRES_URL or\n' +
    'DATABASE_URL, because .env.local points at PRODUCTION. Set\n' +
    'DATABASE_URL_OVERRIDE to the PREVIEW branch POOLED connection string.\n'
  )
  process.exit(1)
}

let host = '<unparseable>'
try { host = new URL(url).host } catch { /* keep sentinel */ }

// ── 🔒 Pooler-only guard ──────────────────────────────────────────────────
// A direct connection always honours rollback. Running there would produce a
// confident PASS that answers a question nobody asked.
if (!host.includes('-pooler')) {
  console.error(`\n🔒 REFUSING TO RUN: host does not look like a pooled endpoint.\n`)
  console.error(`   host: ${host}\n`)
  console.error(
    '   A DIRECT Postgres connection ALWAYS honours rollback, so this probe\n' +
    '   would pass trivially and prove nothing. The question is specifically\n' +
    '   whether pgBouncer in transaction mode preserves rollback.\n\n' +
    '   Use the Neon connection string whose hostname contains "-pooler"\n' +
    '   (the same one the app uses via POSTGRES_URL).\n'
  )
  process.exit(1)
}

const MARKER = `__rollback_probe_${Date.now()}__`

// Same client options as src/db/index.ts — `prepare: false` is required for the
// Neon pooler, and different options would test a different thing.
const client = postgres(url, {
  prepare: false,
  idle_timeout: 20,
  max: 1,
  connect_timeout: 30,
})
const db = drizzle(client)

class DeliberateProbeFailure extends Error {}

async function main() {
  // Printed BEFORE any write, so a wrong target can be aborted.
  console.log(`\n── target ────────────────────────────────────`)
  console.log(`  host   : ${host}`)
  console.log(`  pooled : yes (hostname contains "-pooler")`)
  console.log(`  marker : ${MARKER}`)
  console.log(`──────────────────────────────────────────────`)
  console.log('\nOpening a transaction, inserting, then throwing on purpose…\n')

  let insertedId: string | null = null

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(cronRuns)
        .values({ jobName: MARKER, triggeredBy: 'manual', status: 'running' })
        .returning({ id: cronRuns.id })

      insertedId = row?.id ?? null
      console.log(`  inserted id inside tx : ${insertedId}`)
      if (!insertedId) throw new Error('__probe_no_id__')

      // ⚠️ The whole point. Everything above must be undone by this.
      throw new DeliberateProbeFailure('deliberate failure inside transaction')
    })

    console.error('\n❓ INCONCLUSIVE-A: the throw did NOT propagate out of db.transaction().')
    console.error('   The driver swallowed the error — the wrapper is not behaving as a')
    console.error('   transaction. Rollback status unknown.')
    console.error('   NEXT: check drizzle-orm / postgres versions against the lockfile,')
    console.error('   then re-run. Do NOT build on rollback.\n')
    process.exitCode = 1
    await client.end()
    return
  } catch (err) {
    if (err instanceof Error && err.message === '__probe_no_id__') {
      console.error('\n❓ INCONCLUSIVE-C: the INSERT returned no row id.')
      console.error('   Nothing to look for afterwards, so the test never ran.')
      console.error('   NEXT: verify cron_runs columns match schema.ts on this branch')
      console.error('   (migration 037), then re-run.\n')
      process.exitCode = 1
      await client.end()
      return
    }
    if (!(err instanceof DeliberateProbeFailure)) {
      console.error('\n❓ INCONCLUSIVE-B: an unexpected error type was thrown.')
      console.error('   The probe never reached the test, so this says NOTHING about')
      console.error('   rollback either way.')
      console.error('   NEXT: read the error below — connection refused, auth failure,')
      console.error('   cron_runs missing on this branch, or SSL. Fix and re-run.\n')
      console.error(err)
      process.exitCode = 1
      await client.end()
      return
    }
    console.log('  throw propagated out of db.transaction() ✓')
  }

  const found = await db
    .select({ id: cronRuns.id })
    .from(cronRuns)
    .where(eq(cronRuns.id, insertedId!))

  if (found.length === 0) {
    console.log('\n✅ ROLLBACK WORKS on the pooled endpoint. The row is gone.')
    console.log('   deductPoints, claimProduct and the redemption path are genuinely')
    console.log('   atomic. Safe to build approveClaim on rollback.\n')
  } else {
    console.error('\n🔴🔴 ROLLBACK IS BROKEN — the row SURVIVED a thrown transaction.')
    console.error('   This is NOT a blocked feature. It is a live money defect:')
    console.error('   deductPoints is in production and a partial failure leaves a')
    console.error('   balance decremented with no point_transactions row to explain it.')
    console.error('   claimProduct and the redemption path have the same exposure.')
    console.error('   Deleting the probe row now…')
    await db.delete(cronRuns).where(eq(cronRuns.id, insertedId!))
    console.error('   Probe row deleted. STOP and treat this as an incident.\n')
    process.exitCode = 1
  }

  await client.end()
}

main().catch(async (e) => {
  console.error('\n❓ INCONCLUSIVE-B: probe crashed outside the transaction.')
  console.error('   Says nothing about rollback. NEXT: read the error, fix, re-run.\n')
  console.error(e)
  process.exitCode = 1
  try { await client.end() } catch { /* ignore */ }
})

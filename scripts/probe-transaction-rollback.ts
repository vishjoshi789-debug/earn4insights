/**
 * DELIBERATELY-FAILING PROBE — does `db.transaction()` ROLL BACK on the
 * pgBouncer pooler?
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * COMMIT is proven by data: `api/consumer/rewards/redeem/route.ts:154` opens a
 * `db.transaction()`, and the 2026-08-23 row in `payment_redemptions` is that
 * transaction's output on production. (Note the naming trap —
 * `rewardRedemptionRepository.createRedemption` writes `payment_redemptions`,
 * NOT `reward_redemptions`, which has never held a row.)
 *
 * **But commit and rollback are different behaviours, and pgBouncer in
 * transaction mode can break the second while the first looks fine.**
 * `approveClaim` depends entirely on rollback: a failure partway through must
 * leave NOTHING written. Proving commit and assuming rollback is precisely the
 * "verified the middle of the path" error this project keeps hitting.
 *
 * Same shape as the deliberately-failing typecheck probe: make it fail on
 * purpose and confirm the failure behaves.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────
 * 1. Opens a real `db.transaction()` using the app's own client config.
 * 2. INSERTs a marked row into `cron_runs`.
 * 3. THROWS inside the transaction.
 * 4. Outside, queries for that row by id.
 *    - absent  → rollback WORKS  → safe to build approveClaim on it
 *    - present → rollback BROKEN → the row is deleted and the probe fails loud
 *
 * `cron_runs` is the target on purpose: nothing FKs into it, a stray row has no
 * business meaning, it is trivially identifiable by `job_name`, and the table
 * already tolerates junk rows by design.
 *
 * ── 🔒 IT CANNOT TOUCH PRODUCTION ─────────────────────────────────────────
 * It REFUSES to run unless `DATABASE_URL_OVERRIDE` is set explicitly. It never
 * falls back to `POSTGRES_URL` / `DATABASE_URL`, because `.env.local` points at
 * the PRODUCTION database (CLAUDE.md §11) and a fallback is exactly how a probe
 * that writes ends up writing to prod. It prints the host before doing
 * anything.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────
 *   $env:DATABASE_URL_OVERRIDE = '<preview branch pooled URL>'
 *   npx tsx scripts/probe-transaction-rollback.ts
 *
 * Delete this file once the answer is recorded.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { cronRuns } from '../src/db/schema'

const url = process.env.DATABASE_URL_OVERRIDE
if (!url) {
  console.error(
    '\n🔒 REFUSING TO RUN: DATABASE_URL_OVERRIDE is not set.\n\n' +
    'This probe WRITES. It deliberately does not fall back to POSTGRES_URL or\n' +
    'DATABASE_URL, because .env.local points at PRODUCTION. Set\n' +
    'DATABASE_URL_OVERRIDE to the PREVIEW branch connection string and re-run.\n'
  )
  process.exit(1)
}

const host = (() => {
  try { return new URL(url).host } catch { return '<unparseable>' }
})()

const MARKER = `__rollback_probe_${Date.now()}__`

// Same client options as src/db/index.ts — `prepare: false` is required for the
// Neon pooler, and using different options would test a different thing.
const client = postgres(url, {
  prepare: false,
  idle_timeout: 20,
  max: 1,
  connect_timeout: 30,
})
const db = drizzle(client)

class DeliberateProbeFailure extends Error {}

async function main() {
  console.log(`\nTarget host : ${host}`)
  console.log(`Marker      : ${MARKER}`)
  console.log('Opening a transaction, inserting, then throwing on purpose…\n')

  let insertedId: string | null = null

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(cronRuns)
        .values({ jobName: MARKER, triggeredBy: 'manual', status: 'running' })
        .returning({ id: cronRuns.id })

      insertedId = row?.id ?? null
      console.log(`  inserted id inside tx : ${insertedId}`)
      if (!insertedId) throw new Error('Probe setup failed: no id returned')

      // ⚠️ The whole point. Everything above must be undone by this.
      throw new DeliberateProbeFailure('deliberate failure inside transaction')
    })
    console.error('\n❌ INCONCLUSIVE: the transaction did not propagate the throw.')
    process.exitCode = 1
  } catch (err) {
    if (!(err instanceof DeliberateProbeFailure)) {
      console.error('\n❌ INCONCLUSIVE: threw something unexpected:', err)
      process.exitCode = 1
      await client.end()
      return
    }
    console.log('  throw propagated out of db.transaction() ✓')
  }

  if (!insertedId) {
    console.error('\n❌ INCONCLUSIVE: never captured an inserted id.')
    process.exitCode = 1
    await client.end()
    return
  }

  const found = await db
    .select({ id: cronRuns.id })
    .from(cronRuns)
    .where(eq(cronRuns.id, insertedId))

  if (found.length === 0) {
    console.log('\n✅ ROLLBACK WORKS on the pooler. The row is gone.')
    console.log('   Safe to build approveClaim on db.transaction() rollback.\n')
  } else {
    console.error('\n🔴🔴 ROLLBACK IS BROKEN. The row SURVIVED a thrown transaction.')
    console.error('   Every "atomic" write in this codebase is a lie, including')
    console.error('   claimProduct, deductPoints and the redemption path.')
    console.error('   Deleting the probe row now…')
    await db.delete(cronRuns).where(eq(cronRuns.id, insertedId))
    console.error('   Probe row deleted. DO NOT build approveClaim on rollback.\n')
    process.exitCode = 1
  }

  await client.end()
}

main().catch(async (e) => {
  console.error('\n❌ Probe crashed:', e)
  process.exitCode = 1
  try { await client.end() } catch { /* ignore */ }
})

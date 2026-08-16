import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { cronRuns } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Uniform auth + run-recording for scheduled jobs.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * ~33 scheduled jobs, none of which left evidence of execution. "Did
 * nothing", "crashed", and "never fired" were indistinguishable. Two
 * investigations — the intent pipeline and social ingestion — each cost hours
 * on that ambiguity alone. This fixes the pattern.
 *
 * ── USAGE — one line per route ────────────────────────────────────────────
 *   export const GET = withCronRun('process-social-mentions', async (req) => {
 *     …existing body, unchanged…
 *     return { processed: 4 }      // plain object OR NextResponse, both fine
 *   })
 *
 * The wrapper also performs the `Bearer $CRON_SECRET` check that was
 * duplicated in every route, so adopting it REMOVES more code than it adds.
 *
 * ⚠️⚠️ THE ROW IS INSERTED BEFORE THE HANDLER RUNS. DO NOT "OPTIMISE" THIS
 * INTO A SINGLE WRITE ON COMPLETION.
 *
 * Vercel kills functions at 60s and a hard crash never reaches a `finally`.
 * With insert-at-start, a job that dies mid-run leaves a row with
 * status='running' and finished_at IS NULL — and that stranded row is the
 * ONLY way "fired and died" ever becomes visible. A write-on-completion
 * design faithfully records every success and silently loses exactly the
 * failures this table was built to surface. The extra INSERT is the feature.
 *
 *   SELECT job_name, started_at FROM cron_runs
 *   WHERE status = 'running' AND started_at < now() - interval '15 minutes';
 *
 * ── Recording never breaks the job ────────────────────────────────────────
 * Every write here is wrapped in try/catch that logs and continues. If
 * `cron_runs` does not exist yet, or the DB is briefly unreachable, the job
 * still runs and still returns its normal response — it just isn't recorded.
 * Observability must not become a new failure mode for the thing it observes.
 */

export type CronHandlerResult = NextResponse | Record<string, unknown> | void

export type CronHandler = (request: NextRequest) => Promise<CronHandlerResult>

/**
 * Auth options — these exist ONLY to reproduce, exactly, the three different
 * auth patterns already present across the 33 routes. They are not a menu of
 * new policies. Wrapping a route must never change how it authenticates.
 *
 * Observed patterns:
 *
 *  1. `whenUnset: 'skip'` (default, 23 routes)
 *       const cronSecret = process.env.CRON_SECRET
 *       if (cronSecret && authHeader !== `Bearer ${cronSecret}`) → 401
 *     ⚠️ FAILS OPEN: no secret configured means no check at all.
 *
 *  2. `whenUnset: 'enforce'` + secretEnv ['CRON_SECRET','AUTH_SECRET'] (7 routes)
 *       const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET
 *       if (authHeader !== `Bearer ${cronSecret}`) → 401
 *
 *  3. `whenUnset: 'enforce'` + secretEnv ['CRON_SECRET'] (send-time-analysis)
 *       if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) → 401
 *
 * ⚠️ Patterns 2 and 3 compare against the STRING `"Bearer undefined"` when no
 * secret is set, which is technically guessable. Reproduced verbatim rather
 * than fixed — changing it here would alter live auth behaviour inside an
 * observability change. Logged as a known gap.
 */
export type CronAuthOptions = {
  /** Env vars supplying the shared secret, in precedence order. */
  secretEnv?: string[]
  /** What to do when none of `secretEnv` is set. Default 'skip' (fail open). */
  whenUnset?: 'skip' | 'enforce'
}

/** Where the request came from — see the `triggered_by` column note. */
function resolveTrigger(request: NextRequest): string {
  // Vercel Cron sets this on its own invocations.
  if (request.headers.get('x-vercel-cron')) return 'vercel-cron'
  const ua = request.headers.get('user-agent') ?? ''
  if (/vercel/i.test(ua)) return 'vercel-cron'
  // Several jobs run on cron-job.org because Vercel Hobby is daily-only.
  if (/cron-job\.org/i.test(ua)) return 'external'
  return 'manual'
}

async function startRun(jobName: string, triggeredBy: string): Promise<string | null> {
  try {
    const [row] = await db
      .insert(cronRuns)
      .values({ jobName, triggeredBy, status: 'running' })
      .returning({ id: cronRuns.id })
    return row?.id ?? null
  } catch (err) {
    console.error(`[cron:${jobName}] Could not record run start (non-fatal):`, err)
    return null
  }
}

async function finishRun(
  runId: string | null,
  jobName: string,
  startedAt: number,
  status: 'ok' | 'error',
  payload: { result?: unknown; error?: string },
): Promise<void> {
  if (!runId) return
  try {
    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        status,
        // Cap the stored result — some jobs return large arrays and this
        // column is for diagnosis, not for being a second copy of the data.
        result: payload.result ? truncateForStorage(payload.result) : null,
        error: payload.error?.slice(0, 4000) ?? null,
      })
      .where(eq(cronRuns.id, runId))
  } catch (err) {
    console.error(`[cron:${jobName}] Could not record run finish (non-fatal):`, err)
  }
}

/** Remove a row for something that turned out not to be a run at all. */
async function discardRun(runId: string | null): Promise<void> {
  if (!runId) return
  try {
    await db.delete(cronRuns).where(eq(cronRuns.id, runId))
  } catch (err) {
    console.error('[cron] Could not discard run row (non-fatal):', err)
  }
}

/** Keep the JSONB small and predictable. */
function truncateForStorage(value: unknown): unknown {
  try {
    const json = JSON.stringify(value)
    if (json.length <= 8000) return value
    return { truncated: true, preview: json.slice(0, 8000) }
  } catch {
    return { unserializable: true }
  }
}

export function withCronRun(
  jobName: string,
  handler: CronHandler,
  auth: CronAuthOptions = {},
) {
  const secretEnv = auth.secretEnv ?? ['CRON_SECRET']
  const whenUnset = auth.whenUnset ?? 'skip'

  return async function wrappedCronRoute(request: NextRequest): Promise<NextResponse> {
    // ── Auth ──────────────────────────────────────────────────────────────
    // Reproduces the route's ORIGINAL check exactly — see CronAuthOptions.
    // ⚠️ The default 'skip' mode means an UNSET CRON_SECRET leaves those jobs
    // publicly triggerable. Preserved verbatim so that wrapping never changes
    // auth behaviour; especially relevant to a fresh PREVIEW environment,
    // where the secret may not have been copied across. env-check reports it.
    const secret = secretEnv.map((k) => process.env[k]).find(Boolean)
    const authHeader = request.headers.get('authorization')

    const mustCheck = whenUnset === 'enforce' || Boolean(secret)
    if (mustCheck && authHeader !== `Bearer ${secret}`) {
      // Deliberately NOT recorded: an unauthenticated probe is not a run, and
      // logging them would let anyone flood the table.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startedAt = Date.now()
    const triggeredBy = resolveTrigger(request)
    const runId = await startRun(jobName, triggeredBy)

    try {
      const out = await handler(request)

      if (out instanceof NextResponse) {
        // A 401 from the handler means the route's OWN inline auth rejected
        // the caller. That is a probe, not a run — discard the row so
        // unauthenticated traffic can't flood the table or masquerade as
        // execution history. Matters because most routes keep their inline
        // auth check (see the adoption note in SESSION_RESUME): the wrapper
        // has already inserted a row by the time that check runs.
        if (out.status === 401) {
          await discardRun(runId)
          return out
        }

        // Re-read the body to record it. Cloning first leaves the original
        // stream intact for the caller.
        let parsed: unknown = null
        try {
          parsed = await out.clone().json()
        } catch {
          /* non-JSON response — record nothing rather than guess */
        }
        await finishRun(runId, jobName, startedAt, 'ok', { result: parsed })
        return out
      }

      const body = (out ?? { ok: true }) as Record<string, unknown>
      await finishRun(runId, jobName, startedAt, 'ok', { result: body })
      return NextResponse.json(body)
    } catch (err) {
      const message = err instanceof Error ? (err.stack ?? err.message) : String(err)
      console.error(`[cron:${jobName}] FAILED:`, err)
      await finishRun(runId, jobName, startedAt, 'error', { error: message })
      // Preserve the previous contract: a throwing cron returned a 500.
      return NextResponse.json(
        { error: 'Cron job failed', job: jobName },
        { status: 500 },
      )
    }
  }
}

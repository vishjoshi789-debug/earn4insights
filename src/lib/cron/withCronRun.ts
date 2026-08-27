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
 * Auth options.
 *
 * ── 🔒 FAIL CLOSED IS NOW THE DEFAULT (2026-08-17) ────────────────────────
 * Previously this defaulted to `whenUnset: 'skip'`, reproducing the
 * `if (cronSecret && …)` pattern that 24 routes carried inline: **no secret
 * configured meant no check at all.** An environment missing `CRON_SECRET`
 * had every scheduled job publicly triggerable by URL — including
 * `jobs/process-deletions`, which permanently deletes user accounts.
 *
 * `send-time-analysis` was the only route that already compared
 * unconditionally. **The standard now matches IT, not the other way round.**
 *
 * Because the wrapper's check runs BEFORE each route's own inline check, this
 * one default closes the hole for all 33 routes at once — the inline blocks
 * become redundant rather than load-bearing.
 *
 * ⚠️ Consequence, and it is the intended one: an environment without a
 * configured secret gets **401 on every cron**, not silent execution. That is
 * a visible, diagnosable failure instead of an invisible open door.
 * `/api/admin/env-check` reports whether the secret is set.
 *
 * ⚠️ `'skip'` is retained ONLY so the old behaviour is expressible and
 * greppable. **Nothing passes it, and nothing should.** If you find yourself
 * reaching for it, you are re-opening a hole that was closed deliberately.
 *
 * ── secretEnv ─────────────────────────────────────────────────────────────
 * Nine routes authenticate against `CRON_SECRET || AUTH_SECRET` via their own
 * `verifyAuth` helper. They pass `secretEnv: ['CRON_SECRET', 'AUTH_SECRET']`
 * so the wrapper's check accepts exactly what their inline check accepts —
 * otherwise the wrapper would reject a valid `AUTH_SECRET` caller before the
 * route ever saw it. Their fallback is preserved, not removed.
 */
export type CronAuthOptions = {
  /** Env vars supplying the shared secret, in precedence order. */
  secretEnv?: string[]
  /**
   * What to do when none of `secretEnv` is set.
   * Default **'enforce'** — reject. See the fail-closed note above.
   */
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
  // 🔒 Fail closed by default — see CronAuthOptions.
  const whenUnset = auth.whenUnset ?? 'enforce'

  return async function wrappedCronRoute(request: NextRequest): Promise<NextResponse> {
    // ── Auth — 🔒 FAIL CLOSED ─────────────────────────────────────────────
    // Runs BEFORE the route's own inline check, so this is the effective gate
    // for all 33 routes regardless of what each one still does internally.
    const secret = secretEnv.map((k) => process.env[k]).find(Boolean)
    const authHeader = request.headers.get('authorization')

    // No secret configured → reject UNCONDITIONALLY. Do not fall through to
    // the comparison below.
    //
    // ⚠️ Two separate holes are closed here, and the second is easy to miss:
    //
    //   1. `whenUnset: 'skip'` used to mean "no secret, no check" — an
    //      environment missing CRON_SECRET had every job open to the internet.
    //
    //   2. Comparing against `Bearer ${undefined}` would let anyone in by
    //      sending the literal header `Authorization: Bearer undefined`.
    //      That was the pre-existing behaviour of the nine routes that
    //      "always compared" — they were fail-closed only by accident of
    //      nobody guessing the string. Returning early makes it real.
    if (!secret) {
      if (whenUnset === 'enforce') {
        console.error(
          `[cron:${jobName}] REJECTED — no secret configured in ${secretEnv.join(' | ')}. ` +
          `Cron jobs fail closed; set the env var and redeploy.`
        )
        return NextResponse.json(
          { error: 'Cron authentication is not configured' },
          { status: 401 },
        )
      }
      // 'skip' — legacy fail-open. Nothing passes this; see CronAuthOptions.
      console.warn(`[cron:${jobName}] Running UNAUTHENTICATED (whenUnset='skip')`)
    } else if (authHeader !== `Bearer ${secret}`) {
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
        // ⚠️ A RETURNED 5xx IS A FAILED RUN, NOT AN 'ok' ONE.
        //
        // This previously recorded 'ok' for any response the handler
        // RETURNED, reserving 'error' for ones that THREW. So a route that
        // catches its own exception and returns — a 500, or worse a 200 with
        // the error buried in the body — was recorded as a clean run.
        //
        // Found via process-payouts: it caught a missing-column error, pushed
        // it into `errors[]`, and returned `success: true` with HTTP 200.
        // cron_runs recorded 'ok'. That is exactly the state migration 037
        // exists to make visible, so the wrapper must not launder it.
        //
        // Status is the only signal available here — the wrapper cannot know
        // what an arbitrary route's body shape means. Routes that fail
        // without a 5xx have to report that themselves.
        const outcome = out.status >= 500 ? 'error' : 'ok'
        await finishRun(
          runId,
          jobName,
          startedAt,
          outcome,
          outcome === 'error'
            ? { error: `handler returned HTTP ${out.status}`, result: parsed }
            : { result: parsed },
        )
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

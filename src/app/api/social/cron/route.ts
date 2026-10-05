import { NextRequest, NextResponse } from 'next/server'
import { ingestSocialForAllEnabled } from '@/server/social/socialIngestionService'
import { withCronRun } from '@/lib/cron/withCronRun'

/**
 * POST /api/social/cron — scheduled social ingestion
 *
 * ⚠️⚠️ THIS ROUTE MAY BE DEAD. DO NOT ASSUME IT IS LIVE.
 *
 * Wrapped 2026-09-28 because it was the LAST fail-open cron-shaped route:
 * it exported POST directly with `if (cronSecret && authHeader !== …)` as its
 * only gate, so an unset CRON_SECRET let any authenticated user trigger social
 * ingestion. The wrapper now enforces first and fails closed, matching all 33
 * routes under `withCronRun`.
 *
 * ── HOW IT DIFFERS FROM THE OTHER 33 ─────────────────────────────────────
 *
 * 1. **It is not in `vercel.json`.** All 33 wrapped routes are; this one is
 *    not. Nothing in Vercel schedules it.
 * 2. **It has no caller anywhere in the repo** — no page, no component, no
 *    service.
 * 3. **It drives a DIFFERENT service from the live social cron.** This calls
 *    `ingestSocialForAllEnabled` (`socialIngestionService`), whose ONLY caller
 *    is this file. The scheduled job — `/api/cron/process-social-mentions`,
 *    which IS in `vercel.json` and IS wrapped — uses
 *    `socialListeningRuleRepository` + the platform adapters + `createMention`
 *    instead. Two separate ingestion paths that do not agree.
 * 4. **POST, not GET.** Harmless — `process-content-reviews`,
 *    `support-ticket-reminders` and `jobs/process-deletions` are POST too, and
 *    the wrapper is method-agnostic. But note **Vercel Cron issues GET**, so
 *    even if this were added to `vercel.json` it would not fire as written.
 *
 * So this is the ignition-key pattern inverted: a live endpoint with no
 * trigger, duplicating a job that already runs elsewhere.
 *
 * ⚠️ **RECOMMENDED: DELETE THIS ROUTE.** Wrapping a dead duplicate only makes
 * it a well-instrumented dead duplicate. It was wrapped rather than deleted
 * because **cron-job.org's job list is not visible from the repo** — if an
 * external schedule points here, deleting would silently stop social
 * ingestion, and "nothing in the repo calls it" does not rule that out.
 * Confirm against the cron-job.org console, then delete this file and decide
 * whether `ingestSocialForAllEnabled` should survive at all.
 *
 * ⚠️ `detail: String(err)` below returns raw internal error text to the
 * caller. Left as-is to keep this change auth-only, but it is a leak: the
 * wrapper already records the full stack in `cron_runs.error`, so the detail
 * in the response buys nothing.
 */
export const POST = withCronRun('social/cron', handlePOST)

async function handlePOST(_req: NextRequest) {
  // Auth is handled by withCronRun above — it enforces `Bearer $CRON_SECRET`
  // BEFORE this runs and fails closed when the secret is unset. The previous
  // inline `if (cronSecret && …)` check was removed with the wrap; leaving it
  // would have been dead code that still reads like the gate.
  try {
    const result = await ingestSocialForAllEnabled()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[social/cron] error:', err)
    return NextResponse.json(
      { error: 'Cron ingestion failed', detail: String(err) },
      { status: 500 }
    )
  }
}

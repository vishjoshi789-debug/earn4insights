import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 037: cron run records.
 * POST /api/admin/run-migration-037
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * WHY: ~33 scheduled jobs, none of which left any evidence of execution. A
 * job that did nothing, a job that crashed, and a job that never fired were
 * indistinguishable. Two investigations — the intent pipeline and social
 * ingestion — each burned hours on that ambiguity before finding the cause.
 * This is the fix for the PATTERN, not for either incident.
 *
 * ⚠️ INSERT-AT-START IS LOAD-BEARING. `withCronRun` writes the row BEFORE the
 * handler runs and updates it after. Do not "optimise" it into one write on
 * completion: Vercel kills functions at 60s and a hard crash never reaches a
 * `finally`, so a job that dies leaves status='running' with finished_at NULL
 * — and that stranded row is the ONLY way "fired and died" is observable. A
 * write-on-completion design records the successes and loses exactly the
 * failures this table exists to surface.
 *
 * ── ORDERING: SAFE EITHER WAY (unlike 033/034) ────────────────────────────
 * This adds a NEW TABLE; no code does a bare `select().from(cronRuns)`, so
 * nothing expands to a column that doesn't exist. Every write in
 * `lib/cron/withCronRun.ts` is wrapped in try/catch that logs and continues —
 * recording must never break the job it observes. So deploying before the
 * table exists is harmless: crons run normally and record nothing.
 *
 * Neon-first is still preferred (no error noise, no blind window), but it is
 * a preference here, not a requirement. Same posture as 035.
 *
 * Idempotent: CREATE TABLE / INDEX IF NOT EXISTS. Additive, no backfill.
 *
 * ⚠️ TWO-FILE change: this route AND `PUBLIC_API_ADMIN_PATHS` in middleware.
 *
 * ROLLBACK: DROP TABLE IF EXISTS cron_runs;
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: string; detail?: string }[] = []

  try {
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS cron_runs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_name     TEXT NOT NULL,
        started_at   TIMESTAMP NOT NULL DEFAULT now(),
        finished_at  TIMESTAMP,
        duration_ms  INTEGER,
        status       TEXT NOT NULL DEFAULT 'running',
        result       JSONB,
        error        TEXT,
        triggered_by TEXT
      );
    `)
    results.push({ step: 'create cron_runs', status: 'ensured' })

    // Primary read pattern: "last N runs of job X".
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_cron_runs_job
        ON cron_runs (job_name, started_at DESC);
    `)
    // Supports the stale-run detector — the query that answers "what died?".
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_cron_runs_running
        ON cron_runs (started_at) WHERE status = 'running';
    `)
    results.push({ step: 'create indexes', status: 'ensured' })

    const state = await pgClient.unsafe(`
      SELECT count(*)::int AS runs,
             count(*) FILTER (WHERE status = 'running')::int AS in_flight,
             count(DISTINCT job_name)::int AS jobs_seen
      FROM cron_runs;
    `)
    const row = (state as unknown as Array<Record<string, number>>)[0]
    results.push({
      step: 'state',
      status: 'ok',
      detail:
        `runs=${row?.runs} in_flight=${row?.in_flight} jobs_seen=${row?.jobs_seen} ` +
        `(starts empty; fills from the next scheduled run of each wrapped job)`,
    })

    return NextResponse.json({ ok: true, migration: '037', results })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), results },
      { status: 500 },
    )
  }
}

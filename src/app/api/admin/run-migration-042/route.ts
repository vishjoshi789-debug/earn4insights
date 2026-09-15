import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 042: products.reveal_before_launch — "Coming Soon" opt-in.
 *
 * ⚠️⚠️ APPLIED VIA THE NEON CONSOLE FIRST ON BOTH ENVIRONMENTS (2026-09-15),
 * before the schema change deployed. This route exists for repeatability and
 * as an idempotent confirming no-op. DO NOT rely on it for ordering.
 *
 * WHY THE ORDERING IS MANDATORY: 19 call sites do a bare
 * `db.select().from(products)`, which Drizzle expands to every column in
 * schema.ts. The moment schema.ts declares reveal_before_launch, all 19 ask
 * Postgres for a column that must already exist — the consumer catalog,
 * product detail, recommendations and rankings all 500 otherwise. Same
 * sequence as 033, 034 and 041.
 *
 * ── WHY ──────────────────────────────────────────────────────────
 *
 * launchStatus was 'live' | 'scheduled' with scheduled meaning "hidden from
 * public, visible only to owner". There was no visible-but-unreleased state,
 * so a consumer could never watch a product BEFORE it launched — and launch is
 * the only trigger notifyWatchersOnLaunch has. The recipient set was empty by
 * construction; the notification machinery could never reach anyone. This
 * column is the ignition key.
 *
 * ── DEFAULT TRUE, DELIBERATELY ───────────────────────────────────
 *
 * Verified 0 rows with launch_status = 'scheduled' on production before
 * choosing. Nobody scheduled a launch expecting hidden, so defaulting to
 * revealed removes no choice anyone made. A brand who wants a stealth launch
 * unticks the box at schedule time.
 *
 * Nullable? No. This is a tri-state question with two answers; NULL would be
 * a third meaning nobody defined.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await pgClient.unsafe(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS reveal_before_launch boolean NOT NULL DEFAULT true;
    `)

    const [coverage] = await pgClient.unsafe(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE launch_status = 'scheduled')::int AS scheduled,
             count(*) FILTER (WHERE launch_status = 'scheduled' AND reveal_before_launch)::int AS scheduled_revealed,
             count(*) FILTER (WHERE launch_status = 'scheduled' AND NOT reveal_before_launch)::int AS scheduled_hidden
      FROM products;
    `)

    return NextResponse.json({
      ok: true,
      message: 'Migration 042 completed: products.reveal_before_launch',
      coverage,
      detail:
        'scheduled_revealed are the products consumers can now see and watch before launch. ' +
        'scheduled_hidden are brands who opted out — invisible to consumers everywhere.',
    })
  } catch (error: any) {
    console.error('[Migration042]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 035: email delivery truth.
 * POST /api/admin/run-migration-035
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * WHY: `notification_queue.status='sent'` meant "Resend accepted the API
 * call", never "delivered". A suppressed recipient returns HTTP 200 and is
 * dropped silently — production read **23 sent, 0 failed** with no way to
 * distinguish delivery from silence.
 *
 * The consequence is not cosmetic. Email verification is a HARD BLOCK on
 * feedback submission (EV.1), so a consumer whose verification mail is
 * suppressed can never perform the core action, and shows up to us as merely
 * inactive. At audit time 18 of 29 users were unverified with no way to tell
 * "never received it" from "ignored it".
 *
 * ── Two tables, not columns on notification_queue ────────────────────────
 * The verification email (`emailVerificationService`) and the influencer
 * verification emails (`influencerVerificationEmailService`) call Resend
 * DIRECTLY and never touch the queue — so queue columns could never have
 * covered the most important email on the platform. `email_deliveries` is
 * written by all three send paths.
 *
 * `email_suppressions` is the behavioural half: a hard bounce or a spam
 * complaint poisons the sending domain for EVERY other user, so we stop
 * sending to that address and — crucially — it becomes VISIBLE.
 *
 * ⚠️ Read-only note for whoever runs this: the production RESEND_API_KEY is
 * SENDING-SCOPED. Every read endpoint (`/domains`, `/emails`, `/api-keys`,
 * `/audiences`) returns 401 `restricted_api_key`. That is expected and does
 * NOT mean the key is dead — `POST /emails` works. It also means we cannot
 * backfill historical bounce data from Resend; this table starts empty and
 * fills from the webhook forward.
 *
 * Idempotent: CREATE TABLE / CREATE INDEX IF NOT EXISTS only. Additive,
 * no backfill, deletes nothing. No BEGIN/COMMIT (pooled connection).
 *
 * ⚠️ Creating a run-migration-NNN route is a TWO-FILE change: this file AND
 * `PUBLIC_API_ADMIN_PATHS` in `src/middleware.ts`. Without the allowlist entry
 * middleware returns 401 before route resolution — indistinguishable from a
 * wrong ADMIN_API_KEY.
 *
 * ROLLBACK:
 *   DROP TABLE IF EXISTS email_deliveries;
 *   DROP TABLE IF EXISTS email_suppressions;
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: string; detail?: string }[] = []

  try {
    // ── 1. Per-send delivery record ───────────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS email_deliveries (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_message_id   TEXT,
        provider              TEXT NOT NULL DEFAULT 'resend',
        user_id               TEXT,
        to_email              TEXT NOT NULL,
        email_type            TEXT NOT NULL,
        subject               TEXT,
        notification_queue_id UUID,
        status                TEXT NOT NULL DEFAULT 'accepted',
        detail                TEXT,
        created_at            TIMESTAMP NOT NULL DEFAULT now(),
        updated_at            TIMESTAMP NOT NULL DEFAULT now()
      );
    `)
    results.push({ step: 'create email_deliveries', status: 'ensured' })

    // The webhook looks rows up by provider_message_id on every event, and
    // Resend can deliver the same event more than once. UNIQUE (not just an
    // index) so a duplicate insert can be caught rather than silently
    // producing two rows for one email. Partial — the column is nullable.
    await pgClient.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_email_deliveries_provider_msg
        ON email_deliveries (provider_message_id)
        WHERE provider_message_id IS NOT NULL;
    `)
    results.push({ step: 'create unique idx on provider_message_id', status: 'ensured' })

    // Supports "did THIS user get their mail?" and the delivery report.
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_email_deliveries_user
        ON email_deliveries (user_id) WHERE user_id IS NOT NULL;
    `)
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_email_deliveries_status_type
        ON email_deliveries (status, email_type);
    `)
    results.push({ step: 'create lookup indexes', status: 'ensured' })

    // ── 2. Suppression list ───────────────────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS email_suppressions (
        email         TEXT PRIMARY KEY,
        reason        TEXT NOT NULL,
        detail        TEXT,
        first_seen_at TIMESTAMP NOT NULL DEFAULT now(),
        last_event_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `)
    results.push({ step: 'create email_suppressions', status: 'ensured' })

    // ── 3. Report current state ───────────────────────────────────────────
    const state = await pgClient.unsafe(`
      SELECT
        (SELECT count(*)::int FROM email_deliveries)                          AS deliveries,
        (SELECT count(*)::int FROM email_suppressions)                        AS suppressions,
        (SELECT count(*)::int FROM notification_queue WHERE channel='email')  AS legacy_queue_rows,
        (SELECT count(*)::int FROM users WHERE email_verified_at IS NULL)     AS unverified_users;
    `)
    const row = (state as unknown as Array<Record<string, number>>)[0]
    results.push({
      step: 'state',
      status: 'ok',
      detail:
        `deliveries=${row?.deliveries} suppressions=${row?.suppressions} ` +
        `legacy_queue_rows=${row?.legacy_queue_rows} unverified_users=${row?.unverified_users} ` +
        `(deliveries/suppressions start at 0 — the key is send-only, so no historical backfill is possible)`,
    })

    return NextResponse.json({ ok: true, migration: '035', results })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), results },
      { status: 500 },
    )
  }
}

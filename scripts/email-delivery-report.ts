/**
 * Email delivery report — who is actually receiving our email.
 *
 * BACKGROUND
 * ----------
 * `notification_queue.status='sent'` only ever meant "Resend accepted the API
 * call". A suppressed recipient returns HTTP 200 and is dropped silently, so
 * the queue read "23 sent, 0 failed" while we had no idea what landed.
 *
 * Migration 035 + /api/webhooks/resend fixed that going FORWARD. This script
 * is the read side.
 *
 * ⚠️ The production RESEND_API_KEY is SENDING-SCOPED — every Resend read
 * endpoint 401s `restricted_api_key`. So historical bounces cannot be
 * backfilled; `email_deliveries` starts at the moment 035 shipped. For
 * anything before that, the Resend dashboard (Emails → Logs) is the only
 * source, and it must be read by a human.
 *
 * Run:
 *   dotenv -e .env.local -- tsx scripts/email-delivery-report.ts
 */

import { pgClient } from '@/db'

async function run() {
  console.log('\n════════ EMAIL DELIVERY REPORT ════════')

  console.log('\n── Suppressed addresses (receiving NOTHING) ──')
  const suppressed = await pgClient.unsafe(`
    SELECT s.email, s.reason, s.first_seen_at::date AS since,
           left(coalesce(s.detail, ''), 60) AS detail,
           u.role, (u.email_verified_at IS NOT NULL) AS verified
    FROM email_suppressions s
    LEFT JOIN users u ON lower(btrim(u.email)) = s.email
    ORDER BY s.last_event_at DESC;
  `)
  if ((suppressed as unknown as unknown[]).length === 0) {
    console.log('   none — no bounces or complaints recorded')
  } else {
    console.table(suppressed)
    console.log('   ⚠️ Any consumer here CANNOT verify their email, and')
    console.log('      therefore CANNOT submit feedback. Contact them directly.')
  }

  console.log('\n── Delivery outcomes by email type ──')
  console.table(await pgClient.unsafe(`
    SELECT email_type, status, count(*)::int AS n
    FROM email_deliveries GROUP BY 1,2 ORDER BY 1,2;
  `))

  console.log('\n── VERIFICATION emails specifically (the hard block) ──')
  console.table(await pgClient.unsafe(`
    SELECT d.to_email, d.status, d.created_at::date AS sent,
           left(coalesce(d.detail, ''), 50) AS detail,
           (u.email_verified_at IS NOT NULL) AS verified_since
    FROM email_deliveries d
    LEFT JOIN users u ON u.id = d.user_id
    WHERE d.email_type = 'verification'
    ORDER BY d.created_at DESC LIMIT 30;
  `))

  console.log('\n── Unverified users (cannot submit feedback) ──')
  console.log('   Cross-reference with the suppression list above: an address')
  console.log('   that is suppressed explains the non-verification. One that')
  console.log('   is not suppressed means they got the mail and ignored it.')
  console.table(await pgClient.unsafe(`
    SELECT u.email, u.role, u.created_at::date AS signed_up,
           (s.email IS NOT NULL) AS suppressed,
           count(d.id)::int AS verification_emails_recorded
    FROM users u
    LEFT JOIN email_suppressions s ON s.email = lower(btrim(u.email))
    LEFT JOIN email_deliveries d
           ON d.user_id = u.id AND d.email_type = 'verification'
    WHERE u.email_verified_at IS NULL
    GROUP BY u.id, u.email, u.role, u.created_at, s.email
    ORDER BY u.created_at DESC;
  `))

  console.log('\n── Legacy queue (pre-035, status is NOT delivery truth) ──')
  console.table(await pgClient.unsafe(`
    SELECT status, count(*)::int AS n FROM notification_queue
    WHERE channel = 'email' GROUP BY 1;
  `))
  console.log()
}

run()
  .catch((err) => {
    console.error('Fatal:', err)
    process.exitCode = 1
  })
  .finally(() => process.exit(process.exitCode ?? 0))

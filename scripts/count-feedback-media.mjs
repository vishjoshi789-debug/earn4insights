/**
 * READ-ONLY diagnostic: whose feedback media is this?
 *
 * Answers the Phase-2 question for the Blob public-read remediation: are the
 * existing rows pre-beta test uploads (just purge them) or real consumer
 * media (worth rotating)?
 *
 * Performs SELECTs only — no writes, no deletes.
 *
 * Run: dotenv -e .env.local -- node scripts/count-feedback-media.mjs
 */

import postgres from 'postgres'

const url = process.env.POSTGRES_URL || process.env.DATABASE_URL
if (!url) {
  console.error('No POSTGRES_URL / DATABASE_URL in env.')
  process.exit(1)
}

const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 5 })

try {
  const rows = await sql`
    SELECT
      fm.id,
      fm.media_type,
      fm.status,
      fm.created_at,
      f.user_email,
      f.product_id,
      p.name AS product_name,
      p.owner_id
    FROM feedback_media fm
    LEFT JOIN feedback f ON f.id::text = fm.owner_id
    LEFT JOIN products p ON p.id = f.product_id
    WHERE fm.owner_type = 'feedback' AND fm.status <> 'deleted'
    ORDER BY fm.created_at
  `

  console.log('\n=== live feedback_media -> submitter (READ-ONLY) ===')
  for (const r of rows) {
    console.log(
      String(r.media_type).padEnd(6),
      String(r.user_email ?? '(orphan: no parent feedback row)').padEnd(34),
      String(r.product_name ?? '—').slice(0, 24).padEnd(26),
      new Date(r.created_at).toISOString().slice(0, 10)
    )
  }

  const emails = [...new Set(rows.map((r) => r.user_email).filter(Boolean))]
  console.log('\ndistinct submitters :', emails.length)
  for (const e of emails) console.log('   -', e)
  const orphans = rows.filter((r) => !r.user_email).length
  if (orphans) console.log('orphaned media rows :', orphans, '(parent feedback row gone)')
  console.log()
} catch (err) {
  console.error('Query failed:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}

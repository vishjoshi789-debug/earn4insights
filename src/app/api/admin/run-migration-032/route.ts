import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 032: drop the erroneous fk_feedback_media_owner constraint.
 * POST /api/admin/run-migration-032
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * WHY: migration 031 wrongly added
 *   fk_feedback_media_owner: feedback_media.owner_id -> users.id (CASCADE)
 * but feedback_media.owner_id is POLYMORPHIC — owner_type is
 * 'feedback' | 'survey_response' and owner_id holds the parent feedback /
 * survey_responses row id, NEVER a users.id. So the FK violated on EVERY
 * media insert and broke all audio/video/image uploads for both feedback
 * and survey responses. Polymorphic columns are SKIP per the 031 on-delete
 * policy; this one was enumerated by mistake. 031's source has been
 * corrected so a fresh DB never re-adds it; this route converges any
 * environment where 031 already created it (prod).
 *
 * Idempotent: DROP CONSTRAINT IF EXISTS is a no-op once removed. No
 * BEGIN/COMMIT (pooled connection). Drops no data — only a constraint.
 *
 * ROLLBACK: none needed — the constraint was never valid.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: string }[] = []

  try {
    await pgClient.unsafe(`
      ALTER TABLE feedback_media DROP CONSTRAINT IF EXISTS fk_feedback_media_owner;
    `)
    results.push({ step: 'drop fk_feedback_media_owner', status: 'ensured' })

    return NextResponse.json({ ok: true, migration: '032', results })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), results },
      { status: 500 },
    )
  }
}

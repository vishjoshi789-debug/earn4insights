import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia } from '@/db/schema'
import { requireRole } from '@/lib/auth/server'

function authErrorToStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.toLowerCase().includes('forbidden')) return 403
  return 401
}

type ModerateBody = {
  moderationStatus: 'visible' | 'hidden' | 'flagged'
  moderationNote?: string | null
}

/**
 * POST /api/dashboard/feedback-media/:id/moderate
 *
 * Brand-only moderation toggle for media visibility.
 * - Does NOT delete blobs; it only hides/unhides in the dashboard UI.
 */
export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    await requireRole('brand')
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: authErrorToStatus(err) })
  }

  const id = context.params.id
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let body: ModerateBody
  try {
    body = (await request.json()) as ModerateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const allowed = new Set(['visible', 'hidden', 'flagged'])
  if (!body?.moderationStatus || !allowed.has(body.moderationStatus)) {
    return NextResponse.json({ error: 'Invalid moderationStatus' }, { status: 400 })
  }

  const note =
    body.moderationNote === null || body.moderationNote === undefined
      ? null
      : String(body.moderationNote).trim().slice(0, 1000)

  await db
    .update(feedbackMedia)
    .set({
      moderationStatus: body.moderationStatus === 'visible' ? null : body.moderationStatus,
      moderationNote: note,
      moderatedAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .where(eq(feedbackMedia.id, id as any))

  return NextResponse.json({ success: true })
}


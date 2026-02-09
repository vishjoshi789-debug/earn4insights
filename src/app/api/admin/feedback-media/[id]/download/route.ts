import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia } from '@/db/schema'
import { authenticateAdmin, unauthorizedResponse } from '@/lib/auth'

function guessExtensionFromMime(mimeType: string | null): string {
  const m = (mimeType || '').toLowerCase()
  if (m.includes('webm')) return 'webm'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('mp4')) return 'mp4'
  if (m.includes('mpeg')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  return 'bin'
}

/**
 * GET /api/admin/feedback-media/:id/download
 *
 * Authenticated proxy download:
 * - prevents exposing blob URLs in the client/UI
 * - streams the underlying Vercel Blob object
 *
 * Auth:
 * - ADMIN_API_KEY via Authorization: Bearer <key> (or ?apiKey=... in dev)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!authenticateAdmin(request)) {
    return unauthorizedResponse()
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const rows = await db
    .select()
    .from(feedbackMedia)
    .where(eq(feedbackMedia.id, id as any))
    .limit(1)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const media = rows[0]
  if (media.status === 'deleted') {
    return NextResponse.json({ error: 'Gone' }, { status: 410 })
  }

  const blobUrl = media.storageKey
  if (!blobUrl) {
    return NextResponse.json({ error: 'Missing storage URL' }, { status: 500 })
  }

  const upstream = await fetch(blobUrl)
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: 'Failed to fetch media from storage' },
      { status: 502 }
    )
  }

  const contentType =
    upstream.headers.get('content-type') ||
    media.mimeType ||
    'application/octet-stream'

  const ext = guessExtensionFromMime(contentType)
  const filename = `feedback-media-${id}.${ext}`

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': `inline; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}


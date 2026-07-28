import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia } from '@/db/schema'
import { requireRole } from '@/lib/auth/server'
import { getBrandIdForMediaOwner } from '@/db/repositories/feedbackRepository'

function guessExtensionFromMime(mimeType: string | null): string {
  const m = (mimeType || '').toLowerCase()
  if (m.includes('webm')) return 'webm'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('mp4')) return 'mp4'
  if (m.includes('mpeg')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  return 'bin'
}

function authErrorToStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.toLowerCase().includes('forbidden')) return 403
  return 401
}

/**
 * GET /api/dashboard/feedback-media/:id/download
 *
 * Dashboard-authenticated proxy download:
 * - authorizes via NextAuth session cookies
 * - streams the underlying Blob URL without exposing it in the UI
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let brandUser
  try {
    brandUser = await requireRole('brand')
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: authErrorToStatus(err) })
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

  // SECURITY: requireRole('brand') only proves the caller is *a* brand, not
  // that they own this media. Without this check any brand account could
  // stream any other brand's consumer audio/video by id. Resolve the owning
  // brand through the polymorphic parent and fail closed (null => deny).
  // 404, not 403, so a caller can't enumerate valid media ids.
  const ownerBrandId = await getBrandIdForMediaOwner(media.ownerType, media.ownerId)
  if (!ownerBrandId || ownerBrandId !== brandUser.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (media.status === 'deleted') {
    return NextResponse.json({ error: 'Gone' }, { status: 410 })
  }

  const blobUrl = media.storageKey
  const upstream = await fetch(blobUrl)
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Failed to fetch media from storage' }, { status: 502 })
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


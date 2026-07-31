import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { feedbackMedia } from '@/db/schema'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
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

/**
 * GET /api/dashboard/feedback-media/:id/download
 *
 * Dashboard-authenticated proxy download. This is the ONLY way consumer media
 * should reach a browser: the underlying Vercel Blob objects are stored with
 * `access: 'public'`, so their raw URLs are unauthenticated and permanent.
 * Rendering `storageKey` directly in a page hands out a URL that works forever
 * for anyone who sees it — so every player/thumbnail points here instead.
 *
 * Authorization: NextAuth session, then ownership of the media's polymorphic
 * parent (admins bypass per lib/auth/roles.ts).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Session-based, NOT requireRole('brand'): that helper throws for
  // role='admin' before any ownership check could run, which made this route
  // admin-inaccessible — a problem once it became the only path to media.
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  // SECURITY: a valid session only proves the caller is *someone*, not that
  // they own this media. Without this check any account could stream any
  // brand's consumer audio/video by id. Resolve the owning brand through the
  // polymorphic parent and fail closed (null => deny). 404, not 403, so a
  // caller can't enumerate valid media ids.
  if (!isAdminSession(session)) {
    const ownerBrandId = await getBrandIdForMediaOwner(media.ownerType, media.ownerId)
    if (!ownerBrandId || ownerBrandId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  if (media.status === 'deleted') {
    return NextResponse.json({ error: 'Gone' }, { status: 410 })
  }

  const blobUrl = media.storageKey
  if (!blobUrl) {
    return NextResponse.json({ error: 'Missing storage URL' }, { status: 500 })
  }

  // Forward Range so <video>/<audio> can seek. Without this the proxy always
  // returns the whole object with status 200, and browsers can't scrub — a
  // regression the raw (range-capable) Blob URLs didn't have.
  const range = request.headers.get('range')
  const upstream = await fetch(blobUrl, {
    headers: range ? { range } : undefined,
    cache: 'no-store',
  })
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Failed to fetch media from storage' }, { status: 502 })
  }

  const contentType =
    upstream.headers.get('content-type') ||
    media.mimeType ||
    'application/octet-stream'

  const ext = guessExtensionFromMime(contentType)
  const filename = `feedback-media-${id}.${ext}`

  const headers: Record<string, string> = {
    'content-type': contentType,
    'content-disposition': `inline; filename="${filename}"`,
    // Private media behind a session check — never let a shared/CDN cache hold
    // it, and don't leave a copy a later viewer could pull without authorizing.
    'cache-control': 'private, no-store',
    'accept-ranges': upstream.headers.get('accept-ranges') || 'bytes',
  }

  // Pass through the range-response headers so partial content is well-formed.
  for (const h of ['content-range', 'content-length', 'etag', 'last-modified']) {
    const v = upstream.headers.get(h)
    if (v) headers[h] = v
  }

  return new Response(upstream.body, {
    // 206 when upstream honoured the Range request, else 200.
    status: upstream.status === 206 ? 206 : 200,
    headers,
  })
}


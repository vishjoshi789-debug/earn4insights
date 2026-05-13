import { NextRequest, NextResponse } from 'next/server'
import { trackEmailClick } from '@/lib/send-time-optimizer'
import { emailClickRateLimit, ipFromRequest } from '@/lib/rate-limit-upstash'

/**
 * API Route: Track Email Click
 *
 * Called when user clicks a link in an email.
 * Tracks engagement for send-time optimization.
 *
 * Rate limited: 30 / min per IP (distributed via Upstash). When limit
 * is hit we still redirect — don't break the user's email-link UX,
 * just skip the tracking write.
 *
 * Usage: Append ?email_event_id=xxx to all email links
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const eventId = searchParams.get('email_event_id')

  if (!eventId) {
    return NextResponse.json({ error: 'Missing email_event_id' }, { status: 400 })
  }

  // Rate-limit the tracking write. On limit, redirect without tracking.
  const rl = await emailClickRateLimit.limit(ipFromRequest(request))
  if (!rl.success) {
    const fallback = searchParams.get('redirect') || '/'
    return NextResponse.redirect(new URL(fallback, request.url))
  }

  try {
    await trackEmailClick(eventId)

    // Redirect to the actual destination (remove tracking param)
    const redirectUrl = searchParams.get('redirect') || '/'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (error) {
    console.error('[EmailClick] Error tracking click:', error)

    // Still redirect even if tracking fails
    const redirectUrl = searchParams.get('redirect') || '/'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }
}

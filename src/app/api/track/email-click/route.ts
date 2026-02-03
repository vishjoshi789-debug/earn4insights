import { NextRequest, NextResponse } from 'next/server'
import { trackEmailClick } from '@/lib/send-time-optimizer'

/**
 * API Route: Track Email Click
 * 
 * Called when user clicks a link in an email
 * Tracks engagement for send-time optimization
 * 
 * Usage: Append ?email_event_id=xxx to all email links
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const eventId = searchParams.get('email_event_id')
  
  if (!eventId) {
    return NextResponse.json({ error: 'Missing email_event_id' }, { status: 400 })
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

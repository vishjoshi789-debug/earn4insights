import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { analyticsEvents } from '@/db/schema'

/**
 * POST /api/analytics/track
 * Receives batched analytics events from the client tracker.
 * No auth required — fires from every page for every visitor.
 * Extracts geo/device info from request headers server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const events: any[] = Array.isArray(body.events) ? body.events : [body]

    if (events.length === 0) {
      return NextResponse.json({ ok: true, tracked: 0 })
    }

    // Server-side enrichment from headers
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'
    const userAgent = request.headers.get('user-agent') || ''

    // Parse device info from user-agent (server-side, more reliable)
    const deviceInfo = parseUserAgent(userAgent)

    // Geo from Vercel headers (free on Vercel)
    const country = request.headers.get('x-vercel-ip-country') || null
    const region = request.headers.get('x-vercel-ip-country-region') || null
    const city = request.headers.get('x-vercel-ip-city') || null
    const timezone = request.headers.get('x-vercel-ip-timezone') || null

    // Build rows
    const rows = events.slice(0, 50).map((evt: any) => ({
      sessionId: String(evt.sessionId || 'unknown'),
      userId: evt.userId || null,
      userRole: evt.userRole || null,
      anonymousId: evt.anonymousId || null,

      eventType: String(evt.eventType || 'custom'),
      eventName: String(evt.eventName || 'unknown'),
      eventData: evt.eventData || null,

      pageUrl: String(evt.pageUrl || ''),
      pageTitle: evt.pageTitle || null,
      pagePath: evt.pagePath || null,
      referrer: evt.referrer || null,
      utmSource: evt.utmSource || null,
      utmMedium: evt.utmMedium || null,
      utmCampaign: evt.utmCampaign || null,

      elementTag: evt.elementTag || null,
      elementText: evt.elementText ? String(evt.elementText).slice(0, 200) : null,
      elementId: evt.elementId || null,
      elementClass: evt.elementClass ? String(evt.elementClass).slice(0, 500) : null,
      clickX: evt.clickX != null ? Number(evt.clickX) : null,
      clickY: evt.clickY != null ? Number(evt.clickY) : null,

      // Server-side device info (override client values for reliability)
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      screenWidth: evt.screenWidth != null ? Number(evt.screenWidth) : null,
      screenHeight: evt.screenHeight != null ? Number(evt.screenHeight) : null,
      viewportWidth: evt.viewportWidth != null ? Number(evt.viewportWidth) : null,
      viewportHeight: evt.viewportHeight != null ? Number(evt.viewportHeight) : null,
      language: evt.language || null,

      // Server-side geo
      country,
      region,
      city,
      timezone,
      ip,

      sessionStart: evt.sessionStart ? new Date(evt.sessionStart) : null,
      timeOnPage: evt.timeOnPage != null ? Number(evt.timeOnPage) : null,
      scrollDepth: evt.scrollDepth != null ? Number(evt.scrollDepth) : null,
      pageLoadTime: evt.pageLoadTime != null ? Number(evt.pageLoadTime) : null,
    }))

    await db.insert(analyticsEvents).values(rows)

    return NextResponse.json({ ok: true, tracked: rows.length })
  } catch (error) {
    console.error('[Analytics Track] Error:', error)
    // Never fail the response — analytics should be silent
    return NextResponse.json({ ok: false, error: 'tracking_error' }, { status: 200 })
  }
}

// ── User-Agent Parsing ────────────────────────────────────────────

function parseUserAgent(ua: string): {
  deviceType: string
  browser: string
  os: string
} {
  // Device type
  let deviceType = 'desktop'
  if (/tablet|ipad/i.test(ua)) deviceType = 'tablet'
  else if (/mobile|iphone|android.*mobile|windows phone/i.test(ua)) deviceType = 'mobile'

  // Browser
  let browser = 'Unknown'
  if (/edg\//i.test(ua)) {
    const m = ua.match(/Edg\/(\d+)/)
    browser = `Edge ${m?.[1] || ''}`
  } else if (/opr\//i.test(ua) || /opera/i.test(ua)) {
    const m = ua.match(/(?:OPR|Opera)\/(\d+)/)
    browser = `Opera ${m?.[1] || ''}`
  } else if (/chrome\/(\d+)/i.test(ua) && !/edg/i.test(ua)) {
    const m = ua.match(/Chrome\/(\d+)/)
    browser = `Chrome ${m?.[1] || ''}`
  } else if (/safari\/(\d+)/i.test(ua) && !/chrome/i.test(ua)) {
    const m = ua.match(/Version\/(\d+[\.\d]*)/)
    browser = `Safari ${m?.[1] || ''}`
  } else if (/firefox\/(\d+)/i.test(ua)) {
    const m = ua.match(/Firefox\/(\d+)/)
    browser = `Firefox ${m?.[1] || ''}`
  }

  // OS
  let os = 'Unknown'
  if (/windows nt 10/i.test(ua)) os = /windows nt 10.*build.*2[2-9]\d{3}/i.test(ua) ? 'Windows 11' : 'Windows 10'
  else if (/windows nt/i.test(ua)) os = 'Windows'
  else if (/mac os x/i.test(ua)) {
    if (/iphone|ipad|ipod/i.test(ua)) {
      const m = ua.match(/OS (\d+[_\d]*)/)
      os = `iOS ${m?.[1]?.replace(/_/g, '.') || ''}`
    } else {
      const m = ua.match(/Mac OS X (\d+[_\d]*)/)
      os = `macOS ${m?.[1]?.replace(/_/g, '.') || ''}`
    }
  } else if (/android/i.test(ua)) {
    const m = ua.match(/Android (\d+[\.\d]*)/)
    os = `Android ${m?.[1] || ''}`
  } else if (/linux/i.test(ua)) os = 'Linux'
  else if (/cros/i.test(ua)) os = 'ChromeOS'

  return { deviceType, browser: browser.trim(), os: os.trim() }
}

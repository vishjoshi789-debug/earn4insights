import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { analyticsEvents } from '@/db/schema'
import { desc, sql, eq, gte, and, count } from 'drizzle-orm'

const ADMIN_SECRET = process.env.ANALYTICS_ADMIN_SECRET || process.env.ADMIN_API_KEY || 'e4i-admin-2026'

function checkAuth(request: NextRequest): boolean {
  const key = request.headers.get('x-admin-key')
    || request.nextUrl.searchParams.get('key')
  return key === ADMIN_SECRET
}

/**
 * GET /api/admin/analytics
 * Admin-only deep analytics data endpoint.
 * ?key=<secret> for auth
 * ?view=overview|live|visitors|pages|devices|geo|events
 * ?hours=24 (time window)
 */
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const view = request.nextUrl.searchParams.get('view') || 'overview'
  const hours = parseInt(request.nextUrl.searchParams.get('hours') || '24')
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  try {
    switch (view) {
      case 'overview':
        return NextResponse.json(await getOverview(since))
      case 'live':
        return NextResponse.json(await getLiveEvents(since))
      case 'visitors':
        return NextResponse.json(await getVisitors(since))
      case 'pages':
        return NextResponse.json(await getPages(since))
      case 'devices':
        return NextResponse.json(await getDevices(since))
      case 'geo':
        return NextResponse.json(await getGeo(since))
      case 'events':
        return NextResponse.json(await getEventBreakdown(since))
      case 'timeline':
        return NextResponse.json(await getTimeline(since, hours))
      default:
        return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Admin Analytics] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── Overview stats ────────────────────────────────────────────────

async function getOverview(since: Date) {
  const [totals] = await db
    .select({
      totalEvents: count(),
      uniqueSessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
      uniqueVisitors: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}, ${analyticsEvents.anonymousId}))`,
      pageViews: sql<number>`COUNT(*) FILTER (WHERE ${analyticsEvents.eventType} = 'page_view')`,
      clicks: sql<number>`COUNT(*) FILTER (WHERE ${analyticsEvents.eventType} = 'click')`,
      formSubmits: sql<number>`COUNT(*) FILTER (WHERE ${analyticsEvents.eventType} = 'form_submit')`,
      loggedInUsers: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId}) FILTER (WHERE ${analyticsEvents.userId} IS NOT NULL)`,
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))

  return { success: true, data: totals }
}

// ── Live event feed ───────────────────────────────────────────────

async function getLiveEvents(since: Date) {
  const events = await db
    .select({
      id: analyticsEvents.id,
      sessionId: analyticsEvents.sessionId,
      userId: analyticsEvents.userId,
      userRole: analyticsEvents.userRole,
      eventType: analyticsEvents.eventType,
      eventName: analyticsEvents.eventName,
      pagePath: analyticsEvents.pagePath,
      elementText: analyticsEvents.elementText,
      elementTag: analyticsEvents.elementTag,
      browser: analyticsEvents.browser,
      os: analyticsEvents.os,
      deviceType: analyticsEvents.deviceType,
      country: analyticsEvents.country,
      city: analyticsEvents.city,
      ip: analyticsEvents.ip,
      createdAt: analyticsEvents.createdAt,
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(100)

  return { success: true, events }
}

// ── Unique visitors ───────────────────────────────────────────────

async function getVisitors(since: Date) {
  const visitors = await db
    .select({
      visitorId: sql<string>`COALESCE(${analyticsEvents.userId}, ${analyticsEvents.anonymousId})`,
      userId: analyticsEvents.userId,
      userRole: analyticsEvents.userRole,
      sessionCount: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
      eventCount: count(),
      lastSeen: sql<Date>`MAX(${analyticsEvents.createdAt})`,
      firstSeen: sql<Date>`MIN(${analyticsEvents.createdAt})`,
      browser: sql<string>`MODE() WITHIN GROUP (ORDER BY ${analyticsEvents.browser})`,
      os: sql<string>`MODE() WITHIN GROUP (ORDER BY ${analyticsEvents.os})`,
      deviceType: sql<string>`MODE() WITHIN GROUP (ORDER BY ${analyticsEvents.deviceType})`,
      country: sql<string>`MODE() WITHIN GROUP (ORDER BY ${analyticsEvents.country})`,
      city: sql<string>`MODE() WITHIN GROUP (ORDER BY ${analyticsEvents.city})`,
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(
      sql`COALESCE(${analyticsEvents.userId}, ${analyticsEvents.anonymousId})`,
      analyticsEvents.userId,
      analyticsEvents.userRole
    )
    .orderBy(sql`MAX(${analyticsEvents.createdAt}) DESC`)
    .limit(100)

  return { success: true, visitors }
}

// ── Top pages ─────────────────────────────────────────────────────

async function getPages(since: Date) {
  const pages = await db
    .select({
      pagePath: analyticsEvents.pagePath,
      views: count(),
      uniqueVisitors: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}, ${analyticsEvents.anonymousId}))`,
      avgTimeOnPage: sql<number>`AVG(${analyticsEvents.timeOnPage}) FILTER (WHERE ${analyticsEvents.timeOnPage} IS NOT NULL)`,
      avgScrollDepth: sql<number>`AVG(${analyticsEvents.scrollDepth}) FILTER (WHERE ${analyticsEvents.scrollDepth} IS NOT NULL)`,
    })
    .from(analyticsEvents)
    .where(
      and(
        gte(analyticsEvents.createdAt, since),
        eq(analyticsEvents.eventType, 'page_view')
      )
    )
    .groupBy(analyticsEvents.pagePath)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(50)

  return { success: true, pages }
}

// ── Device breakdown ──────────────────────────────────────────────

async function getDevices(since: Date) {
  const [deviceTypes, browsers, operatingSystems] = await Promise.all([
    db.select({
      deviceType: analyticsEvents.deviceType,
      count: count(),
    }).from(analyticsEvents)
      .where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.eventType, 'page_view')))
      .groupBy(analyticsEvents.deviceType)
      .orderBy(sql`COUNT(*) DESC`),

    db.select({
      browser: analyticsEvents.browser,
      count: count(),
    }).from(analyticsEvents)
      .where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.eventType, 'page_view')))
      .groupBy(analyticsEvents.browser)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10),

    db.select({
      os: analyticsEvents.os,
      count: count(),
    }).from(analyticsEvents)
      .where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.eventType, 'page_view')))
      .groupBy(analyticsEvents.os)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10),
  ])

  return { success: true, deviceTypes, browsers, operatingSystems }
}

// ── Geo breakdown ─────────────────────────────────────────────────

async function getGeo(since: Date) {
  const [countries, cities] = await Promise.all([
    db.select({
      country: analyticsEvents.country,
      count: count(),
      uniqueVisitors: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}, ${analyticsEvents.anonymousId}))`,
    }).from(analyticsEvents)
      .where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.eventType, 'page_view')))
      .groupBy(analyticsEvents.country)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(30),

    db.select({
      city: analyticsEvents.city,
      country: analyticsEvents.country,
      count: count(),
    }).from(analyticsEvents)
      .where(and(gte(analyticsEvents.createdAt, since), eq(analyticsEvents.eventType, 'page_view')))
      .groupBy(analyticsEvents.city, analyticsEvents.country)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(30),
  ])

  return { success: true, countries, cities }
}

// ── Event type breakdown ──────────────────────────────────────────

async function getEventBreakdown(since: Date) {
  const events = await db
    .select({
      eventName: analyticsEvents.eventName,
      eventType: analyticsEvents.eventType,
      count: count(),
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.eventName, analyticsEvents.eventType)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(50)

  return { success: true, events }
}

// ── Timeline (hourly buckets) ─────────────────────────────────────

async function getTimeline(since: Date, hours: number) {
  const bucketSize = hours <= 24 ? '1 hour' : hours <= 168 ? '4 hours' : '1 day'

  const timeline = await db
    .select({
      bucket: sql<string>`date_trunc(${bucketSize}, ${analyticsEvents.createdAt})`,
      pageViews: sql<number>`COUNT(*) FILTER (WHERE ${analyticsEvents.eventType} = 'page_view')`,
      clicks: sql<number>`COUNT(*) FILTER (WHERE ${analyticsEvents.eventType} = 'click')`,
      uniqueVisitors: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}, ${analyticsEvents.anonymousId}))`,
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(sql`date_trunc(${bucketSize}, ${analyticsEvents.createdAt})`)
    .orderBy(sql`date_trunc(${bucketSize}, ${analyticsEvents.createdAt})`)

  return { success: true, timeline, bucketSize }
}

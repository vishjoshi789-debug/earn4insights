/**
 * Brand Alert Rules API — Phase 1B
 *
 * GET  /api/brand/alert-rules          — Get all rules for brand
 * PUT  /api/brand/alert-rules          — Create or update a rule
 * PATCH /api/brand/alert-rules?id=xxx  — Toggle a rule on/off
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getAlertRules, upsertAlertRule, toggleAlertRule } from '@/server/brandAlertService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role
    if (!userId || role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const rules = await getAlertRules(userId)
    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[AlertRules GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role
    if (!userId || role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const body = await req.json()
    const { alertType, productId, channels, threshold, enabled } = body

    if (!alertType) {
      return NextResponse.json({ error: 'alertType is required' }, { status: 400 })
    }

    const rule = await upsertAlertRule({
      brandId: userId,
      alertType,
      productId,
      channels,
      threshold,
      enabled,
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('[AlertRules PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role
    if (!userId || role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const ruleId = req.nextUrl.searchParams.get('id')
    if (!ruleId) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 })
    }

    const body = await req.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
    }

    const updated = await toggleAlertRule(ruleId, userId, enabled)
    if (!updated) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json({ rule: updated })
  } catch (error) {
    console.error('[AlertRules PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

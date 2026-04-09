import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getRulesForEntity,
  upsertRule,
  setRuleActive,
} from '@/db/repositories/socialListeningRuleRepository'

/**
 * GET /api/brand/social-listening/rules
 *   Returns all listening rules for the authenticated brand.
 *   Query: ?entityType=brand|product &entityId=<id>
 *   If no entityType/entityId, defaults to entityType=brand, entityId=userId.
 *
 * POST /api/brand/social-listening/rules
 *   Create or update a listening rule.
 *   Body: { entityType?, entityId?, keywords: string[], platforms: string[], isActive?: boolean }
 *   Defaults entityType=brand, entityId=userId if not provided.
 *
 * PATCH /api/brand/social-listening/rules
 *   Toggle a rule active/inactive.
 *   Body: { ruleId: string, isActive: boolean }
 *
 * Access: brand role only.
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string
    const role   = (session.user as any).role as string
    if (role !== 'brand') return NextResponse.json({ error: 'Brand access only' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') ?? 'brand'
    const entityId   = searchParams.get('entityId')   ?? userId

    const rules = await getRulesForEntity(entityType, entityId)
    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[GET /api/brand/social-listening/rules]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id as string
    const role   = (session.user as any).role as string
    if (role !== 'brand') return NextResponse.json({ error: 'Brand access only' }, { status: 403 })

    const body = await request.json()
    const {
      entityType = 'brand',
      entityId   = userId,
      keywords,
      platforms,
      isActive,
    } = body

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords (non-empty array) is required' }, { status: 400 })
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: 'platforms (non-empty array) is required' }, { status: 400 })
    }

    // Brands can only create rules for their own entityId unless it's a product they own
    // (ownership check delegated to product layer — brand can specify their own productId)
    const rule = await upsertRule(entityType, entityId, {
      keywords:  keywords.map(String),
      platforms: platforms.map(String),
      isActive:  isActive !== false,
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/brand/social-listening/rules]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role as string
    if (role !== 'brand') return NextResponse.json({ error: 'Brand access only' }, { status: 403 })

    const body = await request.json()
    const { ruleId, isActive } = body

    if (!ruleId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'ruleId and isActive (boolean) are required' }, { status: 400 })
    }

    await setRuleActive(ruleId, isActive)
    return NextResponse.json({ success: true, ruleId, isActive })
  } catch (error) {
    console.error('[PATCH /api/brand/social-listening/rules]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

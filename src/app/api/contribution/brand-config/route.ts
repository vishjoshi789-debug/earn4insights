import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { brandRewardConfigs, products } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/contribution/brand-config
 * Returns brand reward configs for the current brand user's products.
 *
 * POST /api/contribution/brand-config
 * Create or update a brand reward config.
 * Body: { productId?, contributionType, weight, priorityKeywords?, bonusMultiplier? }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role
    if (role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const brandId = session.user.id

    const configs = await db
      .select()
      .from(brandRewardConfigs)
      .where(eq(brandRewardConfigs.brandId, brandId))

    return NextResponse.json({ configs })
  } catch (error) {
    console.error('[Brand Config GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role
    if (role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const brandId = session.user.id
    const body = await req.json()
    const { productId, contributionType, weight, priorityKeywords, bonusMultiplier } = body

    if (!contributionType) {
      return NextResponse.json({ error: 'contributionType is required' }, { status: 400 })
    }

    const validTypes = ['feedback_submit', 'survey_complete', 'community_post', 'community_reply']
    if (!validTypes.includes(contributionType)) {
      return NextResponse.json({ error: `Invalid contributionType. Valid: ${validTypes.join(', ')}` }, { status: 400 })
    }

    // If productId provided, verify ownership
    if (productId) {
      const [product] = await db
        .select({ ownerId: products.ownerId })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)

      if (!product || product.ownerId !== brandId) {
        return NextResponse.json({ error: 'Product not found or not owned by you' }, { status: 403 })
      }
    }

    const safeWeight = Math.max(0.1, Math.min(5.0, Number(weight) || 1.0))
    const safeBonus = Math.max(0.1, Math.min(3.0, Number(bonusMultiplier) || 1.0))
    const safeKeywords = Array.isArray(priorityKeywords)
      ? priorityKeywords.filter((k: unknown) => typeof k === 'string').slice(0, 20).map((k: string) => k.slice(0, 50))
      : []

    // Check if config already exists for this combo
    const conditions = [
      eq(brandRewardConfigs.brandId, brandId),
      eq(brandRewardConfigs.contributionType, contributionType),
    ]
    if (productId) {
      conditions.push(eq(brandRewardConfigs.productId, productId))
    }

    const existing = await db
      .select()
      .from(brandRewardConfigs)
      .where(and(...conditions))
      .limit(1)

    if (existing.length > 0) {
      // Update
      await db
        .update(brandRewardConfigs)
        .set({
          weight: safeWeight,
          priorityKeywords: safeKeywords,
          bonusMultiplier: safeBonus,
          updatedAt: new Date(),
        })
        .where(eq(brandRewardConfigs.id, existing[0].id))

      return NextResponse.json({ config: { ...existing[0], weight: safeWeight, priorityKeywords: safeKeywords, bonusMultiplier: safeBonus } })
    }

    // Create new
    const [config] = await db
      .insert(brandRewardConfigs)
      .values({
        brandId,
        productId: productId || null,
        contributionType,
        weight: safeWeight,
        priorityKeywords: safeKeywords,
        bonusMultiplier: safeBonus,
      })
      .returning()

    return NextResponse.json({ config }, { status: 201 })
  } catch (error) {
    console.error('[Brand Config POST] Error:', error)
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
  }
}

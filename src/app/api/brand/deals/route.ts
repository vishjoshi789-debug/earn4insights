/**
 * GET  /api/brand/deals — List brand's deals (with optional status filter)
 * POST /api/brand/deals — Create a new deal
 *
 * Access: brand role only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { createBrandDeal, getBrandDeals } from '@/server/dealsService'

async function getBrandUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = (session.user as any).role
  if (role !== 'brand') {
    return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
  }
  return { userId: (session.user as any).id }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const p = req.nextUrl.searchParams
    const result = await getBrandDeals(authResult.userId, {
      status: p.get('status') ?? undefined,
      cursor: p.get('cursor') ?? undefined,
      limit: Math.min(parseInt(p.get('limit') ?? '20'), 50),
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[BrandDeals GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBrandUser()
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { title, description, dealType, discountValue, discountCurrency, promoCode, redirectUrl, originalPrice, discountedPrice, maxRedemptions, validFrom, validUntil, category, tags, icpTargetData, productId } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }
    if (!dealType || typeof dealType !== 'string') {
      return NextResponse.json({ error: 'dealType is required' }, { status: 400 })
    }

    const deal = await createBrandDeal(authResult.userId, {
      title,
      description,
      dealType,
      discountValue: discountValue ?? null,
      discountCurrency: discountCurrency ?? 'INR',
      promoCode: promoCode ?? null,
      redirectUrl: redirectUrl ?? null,
      originalPrice: originalPrice ?? null,
      discountedPrice: discountedPrice ?? null,
      maxRedemptions: maxRedemptions ?? null,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      category: category ?? null,
      tags: tags ?? [],
      icpTargetData: icpTargetData ?? null,
      productId: productId ?? null,
    })

    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    console.error('[BrandDeals POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/deals/search
 *
 * Full-text search + filters for active deals.
 * Public — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchDeals } from '@/server/dealsService'

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams
    const result = await searchDeals({
      q: p.get('q') ?? undefined,
      category: p.get('category') ?? undefined,
      brandId: p.get('brandId') ?? undefined,
      dealType: p.get('dealType') ?? undefined,
      minDiscount: p.get('minDiscount') ? Number(p.get('minDiscount')) : undefined,
      maxPrice: p.get('maxPrice') ? Number(p.get('maxPrice')) : undefined,
      sort: (p.get('sort') as any) ?? 'newest',
      cursor: p.get('cursor') ?? undefined,
      limit: Math.min(parseInt(p.get('limit') ?? '20'), 50),
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[DealsSearch GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../../../_auth'
import {
  getCompetitorById,
  updateProductPrice,
} from '@/db/repositories/competitiveIntelligenceRepository'
import { detectPriceChange } from '@/server/competitiveAlertService'
import { db } from '@/db'
import { competitorProducts } from '@/db/schema'
import { eq } from 'drizzle-orm'

type RouteCtx = { params: Promise<{ id: string; pid: string }> }

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id, pid } = await ctx.params
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response

  const profile = await getCompetitorById(id)
  if (!profile || profile.brandId !== authed.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [existing] = await db
    .select()
    .from(competitorProducts)
    .where(eq(competitorProducts.id, pid))
    .limit(1)
  if (!existing || existing.competitorProfileId !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  if (typeof body.price !== 'number') {
    return NextResponse.json({ error: 'price (number) required' }, { status: 400 })
  }
  const source = (body.source ?? 'manual') as 'manual' | 'scraper' | 'community' | 'deal'
  const currency = body.currency ?? existing.currency ?? 'INR'

  const history = await updateProductPrice(pid, body.price, currency, source)

  if (typeof existing.currentPrice === 'number') {
    await detectPriceChange({
      brandId: authed.userId,
      competitorProfileId: id,
      competitorName: profile.competitorName,
      productId: pid,
      productName: existing.productName,
      oldPrice: existing.currentPrice,
      newPrice: body.price,
      currency,
    })
  }

  return NextResponse.json({ history })
}

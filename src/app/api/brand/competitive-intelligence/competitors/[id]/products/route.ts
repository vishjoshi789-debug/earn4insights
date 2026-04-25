import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../../_auth'
import {
  getCompetitorById,
  getCompetitorProducts,
  createCompetitorProduct,
} from '@/db/repositories/competitiveIntelligenceRepository'

type RouteCtx = { params: Promise<{ id: string }> }

async function authAndOwn(req: NextRequest, id: string) {
  const authed = await requireBrand(req)
  if (!authed.ok) return { response: authed.response }
  const profile = await getCompetitorById(id)
  if (!profile || profile.brandId !== authed.userId) {
    return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { userId: authed.userId, profile }
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  const g = await authAndOwn(req, id)
  if ('response' in g) return g.response
  const activeOnly = req.nextUrl.searchParams.get('activeOnly') === 'true'
  const products = await getCompetitorProducts(id, { activeOnly })
  return NextResponse.json({ products })
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  const g = await authAndOwn(req, id)
  if ('response' in g) return g.response

  const body = await req.json()
  if (!body.productName || !body.category) {
    return NextResponse.json({ error: 'productName and category are required' }, { status: 400 })
  }
  try {
    const created = await createCompetitorProduct({
      competitorProfileId: id,
      productName: String(body.productName).slice(0, 200),
      productId: body.productId ?? null,
      category: body.category,
      description: body.description ?? null,
      currentPrice: typeof body.currentPrice === 'number' ? body.currentPrice : null,
      currency: body.currency ?? 'INR',
      priceUpdatedAt: typeof body.currentPrice === 'number' ? new Date() : null,
      features: body.features ?? [],
      positioning: body.positioning ?? null,
      targetSegment: body.targetSegment ?? null,
      externalUrl: body.externalUrl ?? null,
      isActive: true,
    })
    return NextResponse.json({ product: created }, { status: 201 })
  } catch (err) {
    console.error('[CI/competitors/[id]/products] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

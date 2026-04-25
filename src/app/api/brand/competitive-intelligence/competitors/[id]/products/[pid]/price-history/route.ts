import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../../../../_auth'
import {
  getCompetitorById,
  getPriceHistory,
} from '@/db/repositories/competitiveIntelligenceRepository'
import { db } from '@/db'
import { competitorProducts } from '@/db/schema'
import { eq } from 'drizzle-orm'

type RouteCtx = { params: Promise<{ id: string; pid: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id, pid } = await ctx.params
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response

  const profile = await getCompetitorById(id)
  if (!profile || profile.brandId !== authed.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const [product] = await db
    .select({ id: competitorProducts.id, competitorProfileId: competitorProducts.competitorProfileId })
    .from(competitorProducts)
    .where(eq(competitorProducts.id, pid))
    .limit(1)
  if (!product || product.competitorProfileId !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const days = Math.max(1, Math.min(365, parseInt(req.nextUrl.searchParams.get('days') ?? '90', 10)))
  const since = new Date(Date.now() - days * 86400000)
  const history = await getPriceHistory(pid, { since, limit: 500 })
  return NextResponse.json({ history, since: since.toISOString(), days })
}

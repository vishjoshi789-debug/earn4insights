import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../_auth'
import { getCategoryRankings } from '@/db/repositories/competitiveIntelligenceRepository'

type RouteCtx = { params: Promise<{ category: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const { category } = await ctx.params
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10))
  const rankings = await getCategoryRankings(decodeURIComponent(category), limit)
  return NextResponse.json({ rankings })
}

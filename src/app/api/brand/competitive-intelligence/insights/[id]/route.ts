import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../_auth'
import { db } from '@/db'
import { competitiveInsights } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { markInsightRead } from '@/db/repositories/competitiveIntelligenceRepository'

type RouteCtx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response

  const [existing] = await db
    .select({ brandId: competitiveInsights.brandId })
    .from(competitiveInsights)
    .where(eq(competitiveInsights.id, id))
    .limit(1)
  if (!existing || existing.brandId !== authed.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const updated = await markInsightRead(id)
  return NextResponse.json({ insight: updated })
}

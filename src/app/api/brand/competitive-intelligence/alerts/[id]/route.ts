import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../_auth'
import { db } from '@/db'
import { competitorAlerts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { markAlertRead } from '@/db/repositories/competitiveIntelligenceRepository'

type RouteCtx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response

  const [existing] = await db
    .select({ brandId: competitorAlerts.brandId })
    .from(competitorAlerts)
    .where(eq(competitorAlerts.id, id))
    .limit(1)
  if (!existing || existing.brandId !== authed.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const updated = await markAlertRead(id)
  return NextResponse.json({ alert: updated })
}

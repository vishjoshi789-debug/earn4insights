import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../_auth'
import {
  getCompetitorById,
  updateCompetitor,
  dismissCompetitor,
} from '@/db/repositories/competitiveIntelligenceRepository'

type RouteCtx = { params: Promise<{ id: string }> }

async function loadOwnedCompetitor(id: string, userId: string) {
  const row = await getCompetitorById(id)
  if (!row) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  if (row.brandId !== userId) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { row }
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const { id } = await ctx.params
  const result = await loadOwnedCompetitor(id, authed.userId)
  if ('error' in result) return result.error
  return NextResponse.json({ competitor: result.row })
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const { id } = await ctx.params
  const result = await loadOwnedCompetitor(id, authed.userId)
  if ('error' in result) return result.error

  try {
    const body = await req.json()
    const allowed: Record<string, unknown> = {}
    for (const k of ['competitorWebsite', 'competitorLogoUrl', 'subCategories', 'geographies', 'notes', 'isActive', 'isConfirmed']) {
      if (k in body) allowed[k] = body[k]
    }
    if (allowed.isConfirmed === true) allowed.confirmedAt = new Date()
    const updated = await updateCompetitor(id, allowed as any)
    return NextResponse.json({ competitor: updated })
  } catch (err) {
    console.error('[CI/competitors/[id]] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const { id } = await ctx.params
  const result = await loadOwnedCompetitor(id, authed.userId)
  if ('error' in result) return result.error

  const dismissed = await dismissCompetitor(id)
  return NextResponse.json({ competitor: dismissed })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../_auth'
import {
  getCompetitorProfiles,
  createCompetitor,
} from '@/db/repositories/competitiveIntelligenceRepository'

export async function GET(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const { searchParams } = req.nextUrl
  const activeOnly = searchParams.get('activeOnly') === 'true'
  const confirmedOnly = searchParams.get('confirmedOnly') === 'true'
  const category = searchParams.get('category') ?? undefined

  try {
    const competitors = await getCompetitorProfiles(authed.userId, { activeOnly, confirmedOnly, category })
    return NextResponse.json({ competitors })
  } catch (err) {
    console.error('[CI/competitors] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  try {
    const body = await req.json()
    if (!body.competitorName || !body.category || !body.competitorType) {
      return NextResponse.json(
        { error: 'competitorName, category, and competitorType are required' },
        { status: 400 }
      )
    }
    if (body.competitorType !== 'on_platform' && body.competitorType !== 'off_platform') {
      return NextResponse.json({ error: 'Invalid competitorType' }, { status: 400 })
    }
    if (body.competitorType === 'on_platform' && !body.competitorBrandId) {
      return NextResponse.json({ error: 'competitorBrandId required for on_platform' }, { status: 400 })
    }

    const created = await createCompetitor({
      brandId: authed.userId,
      competitorType: body.competitorType,
      competitorBrandId: body.competitorBrandId ?? null,
      competitorName: String(body.competitorName).slice(0, 200),
      competitorWebsite: body.competitorWebsite ?? null,
      competitorLogoUrl: body.competitorLogoUrl ?? null,
      category: body.category,
      subCategories: body.subCategories ?? [],
      geographies: body.geographies ?? [],
      isConfirmed: true,
      isActive: true,
      confirmedAt: new Date(),
      notes: body.notes ?? null,
    })
    return NextResponse.json({ competitor: created }, { status: 201 })
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Competitor already tracked' }, { status: 409 })
    }
    console.error('[CI/competitors] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

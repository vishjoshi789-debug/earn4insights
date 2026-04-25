import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../_auth'
import { getInsights } from '@/db/repositories/competitiveIntelligenceRepository'

export async function GET(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const { searchParams } = req.nextUrl
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10))
  const insights = await getInsights(authed.userId, {
    unreadOnly: searchParams.get('unreadOnly') === 'true',
    insightType: searchParams.get('insightType') ?? undefined,
    severity: searchParams.get('severity') ?? undefined,
    actionableOnly: searchParams.get('actionableOnly') === 'true',
    limit,
  })
  return NextResponse.json({ insights })
}

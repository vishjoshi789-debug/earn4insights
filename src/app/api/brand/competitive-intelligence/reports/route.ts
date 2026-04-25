import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../_auth'
import { getReports } from '@/db/repositories/competitiveIntelligenceRepository'

export async function GET(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const { searchParams } = req.nextUrl
  const reports = await getReports(authed.userId, {
    reportType: searchParams.get('reportType') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    limit: Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10)),
  })
  return NextResponse.json({ reports })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../_auth'
import { getAlerts } from '@/db/repositories/competitiveIntelligenceRepository'

export async function GET(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const { searchParams } = req.nextUrl
  const alerts = await getAlerts(authed.userId, {
    unreadOnly: searchParams.get('unreadOnly') === 'true',
    severity: searchParams.get('severity') ?? undefined,
    alertType: searchParams.get('alertType') ?? undefined,
    limit: Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10)),
  })
  return NextResponse.json({ alerts })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../_auth'
import { getSuggestedCompetitors } from '@/db/repositories/competitiveIntelligenceRepository'

export async function GET(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const suggestions = await getSuggestedCompetitors(authed.userId)
  return NextResponse.json({ suggestions })
}

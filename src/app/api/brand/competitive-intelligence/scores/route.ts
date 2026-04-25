import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../_auth'
import {
  getCompetitiveScore,
  getCompetitorProfiles,
  getCategoryRankings,
} from '@/db/repositories/competitiveIntelligenceRepository'

export async function GET(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response

  const category = req.nextUrl.searchParams.get('category')

  // Single category mode
  if (category) {
    const score = await getCompetitiveScore(authed.userId, category)
    const rankings = await getCategoryRankings(category, 10)
    return NextResponse.json({ score, rankings })
  }

  // All categories with active competitors
  const profiles = await getCompetitorProfiles(authed.userId, { activeOnly: true, confirmedOnly: true })
  const categories = Array.from(new Set(profiles.map((p) => p.category))).filter(Boolean)
  const scores = await Promise.all(
    categories.map(async (c) => ({
      category: c,
      score: await getCompetitiveScore(authed.userId, c),
    }))
  )
  return NextResponse.json({ scores })
}

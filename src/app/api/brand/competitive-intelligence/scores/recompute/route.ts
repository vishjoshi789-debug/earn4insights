import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../_auth'
import { RATE_LIMITS } from '@/lib/rate-limit'
import {
  computeCompetitiveScore,
  scoreBrandForAllCategories,
} from '@/server/competitiveScoringService'

export async function POST(req: NextRequest) {
  const authed = await requireBrand(req, {
    limit: RATE_LIMITS.competitiveRecompute,
    limitKeyPrefix: 'ci:recompute',
  })
  if (!authed.ok) return authed.response

  try {
    const body = await req.json().catch(() => ({} as any))
    if (body.category) {
      const result = await computeCompetitiveScore(authed.userId, String(body.category))
      return NextResponse.json({ result })
    }
    const results = await scoreBrandForAllCategories(authed.userId)
    return NextResponse.json({ results, count: results.length })
  } catch (err) {
    console.error('[CI/scores/recompute] error:', err)
    return NextResponse.json({ error: 'Failed to recompute scores' }, { status: 500 })
  }
}

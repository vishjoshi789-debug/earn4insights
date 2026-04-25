import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../_auth'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { generateInsightsForBrand } from '@/server/competitiveIntelligenceService'

export async function POST(req: NextRequest) {
  const authed = await requireBrand(req, {
    limit: RATE_LIMITS.competitiveAiGenerate,
    limitKeyPrefix: 'ci:gen',
  })
  if (!authed.ok) return authed.response
  try {
    const result = await generateInsightsForBrand(authed.userId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[CI/insights/generate] error:', err)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}

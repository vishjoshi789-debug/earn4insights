import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../_auth'
import { competitiveAiGenerateRateLimit } from '@/lib/rate-limit-upstash'
import { generateInsightsForBrand } from '@/server/competitiveIntelligenceService'

export async function POST(req: NextRequest) {
  const authed = await requireBrand(req, { limiter: competitiveAiGenerateRateLimit })
  if (!authed.ok) return authed.response
  try {
    const result = await generateInsightsForBrand(authed.userId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[CI/insights/generate] error:', err)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}

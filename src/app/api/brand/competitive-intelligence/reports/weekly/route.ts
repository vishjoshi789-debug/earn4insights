import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../../_auth'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { generateWeeklyReport } from '@/server/competitiveIntelligenceService'

export async function POST(req: NextRequest) {
  const authed = await requireBrand(req, {
    limit: RATE_LIMITS.competitiveAiGenerate,
    limitKeyPrefix: 'ci:weekly',
  })
  if (!authed.ok) return authed.response

  try {
    const body = await req.json().catch(() => ({} as any))
    if (!body.category) {
      return NextResponse.json({ error: 'category required' }, { status: 400 })
    }
    const result = await generateWeeklyReport(authed.userId, String(body.category))
    if (!result.report) {
      return NextResponse.json({ error: 'No active competitors for category' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[CI/reports/weekly] error:', err)
    return NextResponse.json({ error: 'Failed to generate weekly report' }, { status: 500 })
  }
}

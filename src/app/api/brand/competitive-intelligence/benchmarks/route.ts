import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../_auth'
import { getBenchmarks } from '@/db/repositories/competitiveIntelligenceRepository'

export async function GET(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const { searchParams } = req.nextUrl

  const sinceDays = parseInt(searchParams.get('sinceDays') ?? '0', 10)
  const since = sinceDays > 0 ? new Date(Date.now() - sinceDays * 86400000) : undefined

  const benchmarks = await getBenchmarks(authed.userId, {
    category: searchParams.get('category') ?? undefined,
    metricName: searchParams.get('metric') ?? undefined,
    since,
  })
  return NextResponse.json({ benchmarks })
}

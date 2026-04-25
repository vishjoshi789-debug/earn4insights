import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../_auth'
import { getDashboard } from '@/server/competitiveIntelligenceService'

export async function GET(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  try {
    const data = await getDashboard(authed.userId)
    return NextResponse.json({ dashboard: data })
  } catch (err) {
    console.error('[CI/dashboard] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

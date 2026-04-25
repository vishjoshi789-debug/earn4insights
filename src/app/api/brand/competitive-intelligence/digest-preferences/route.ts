import { NextRequest, NextResponse } from 'next/server'
import { requireBrand } from '../_auth'
import {
  getDigestPreferences,
  upsertDigestPreferences,
} from '@/db/repositories/competitiveIntelligenceRepository'

export async function GET(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response
  const prefs = await getDigestPreferences(authed.userId)
  return NextResponse.json({ preferences: prefs })
}

const VALID_FREQ = new Set(['daily', 'weekly', 'monthly', 'none'])

export async function PUT(req: NextRequest) {
  const authed = await requireBrand(req)
  if (!authed.ok) return authed.response

  const body = await req.json().catch(() => ({} as any))
  if (body.digestFrequency && !VALID_FREQ.has(body.digestFrequency)) {
    return NextResponse.json({ error: 'Invalid digestFrequency' }, { status: 400 })
  }

  const updated = await upsertDigestPreferences(authed.userId, {
    digestFrequency: body.digestFrequency,
    emailEnabled: body.emailEnabled,
    inAppEnabled: body.inAppEnabled,
    categories: Array.isArray(body.categories) ? body.categories : undefined,
    alertTypes: Array.isArray(body.alertTypes) ? body.alertTypes : undefined,
  })
  return NextResponse.json({ preferences: updated })
}
